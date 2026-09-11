use crate::{
    resources,
    tool_context::ToolContext,
    tools::ToolRegistry,
    Error, Result,
};
use datto_api::DattoClient;
use rmcp::{
    model::*,
    service::{RequestContext, RoleServer},
    transport::stdio,
    ErrorData as McpError, ServerHandler, ServiceExt,
};
use std::sync::Arc;

/// MCP server handler for Datto RMM.
///
/// Each instance holds one `DattoClient` (one set of DRMM credentials) and is either
/// shared across all stdio requests or created fresh per-session in SSE mode.
#[derive(Clone)]
pub struct DattoRmmServer {
    client: Arc<DattoClient>,
    tools: Arc<ToolRegistry>,
    /// Identifies the MCP agent instance — propagated to every outbound DRMM API call
    /// as `X-Datto-Mcp-Agent-Id`.
    agent_id: String,
}

impl DattoRmmServer {
    /// Create a server handler from an already-authenticated client.
    pub fn with_client(client: DattoClient, agent_id: impl Into<String>) -> Self {
        Self {
            client: Arc::new(client),
            tools: Arc::new(ToolRegistry::new()),
            agent_id: agent_id.into(),
        }
    }
}

impl ServerHandler for DattoRmmServer {
    fn get_info(&self) -> ServerInfo {
        let mut info = ServerInfo::new(
            ServerCapabilities::builder()
                .enable_tools()
                .enable_resources()
                .enable_logging()
                .build(),
        );
        info.server_info = Implementation::new("datto-rmm", env!("CARGO_PKG_VERSION"));
        info
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> std::result::Result<ListToolsResult, McpError> {
        let tools = self.tools.list_tools();
        Ok(ListToolsResult {
            tools,
            next_cursor: None,
            meta: None,
        })
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        context: RequestContext<RoleServer>,
    ) -> std::result::Result<CallToolResult, McpError> {
        let tool_name = request.name.to_string();
        // Derive correlation_id from the MCP request ID so all downstream DRMM API
        // calls for this tool invocation can be correlated in server logs.
        let correlation_id = context.id.to_string();

        tracing::info!(
            tool = %tool_name,
            correlation_id = %correlation_id,
            agent_id = %self.agent_id,
            "Calling tool"
        );

        let args = request.arguments.as_ref().map(|m| {
            serde_json::Value::Object(m.clone())
        });

        let tool_context = ToolContext {
            tool_name: tool_name.clone(),
            tool_version: env!("CARGO_PKG_VERSION").to_string(),
            correlation_id,
        };

        let result = self
            .tools
            .call_tool(&tool_name, &args, self.client.clone(), tool_context, &self.agent_id)
            .await
            .map_err(|e| {
                tracing::error!(tool = %tool_name, error = %e, "Tool execution failed");
                McpError::from(e)
            })?;

        tracing::info!(tool = %tool_name, "Tool call completed");
        Ok(result)
    }

    async fn list_resources(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> std::result::Result<ListResourcesResult, McpError> {
        Ok(ListResourcesResult {
            resources: resources::list_resources(),
            next_cursor: None,
            meta: None,
        })
    }

    async fn read_resource(
        &self,
        request: ReadResourceRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> std::result::Result<ReadResourceResult, McpError> {
        resources::read_resource(&request.uri).map_err(McpError::from)
    }
}

/// Run the MCP server over stdio.
///
/// Credentials are read from the environment — set by the MCP client (e.g. Claude Desktop)
/// in its server config, never from the user's shell.
pub async fn run_server_stdio(
    platform: datto_api::Platform,
    agent_id: String,
    base_url: Option<String>,
) -> Result<()> {
    let api_key = std::env::var("DATTO_API_KEY")
        .map_err(|_| Error::Config("DATTO_API_KEY not set".into()))?;
    let api_secret = std::env::var("DATTO_API_SECRET")
        .map_err(|_| Error::Config("DATTO_API_SECRET not set".into()))?;

    let client = DattoClient::new_with_base_url(
        platform,
        datto_api::Credentials { api_key, api_secret },
        base_url,
    )
    .await
    .map_err(|e| Error::Api(format!("Failed to create Datto client: {}", e)))?;

    let handler = DattoRmmServer::with_client(client, agent_id);

    tracing::info!("Starting MCP server on stdio");

    let service = handler.serve(stdio()).await.map_err(|e| {
        Error::Mcp(format!("Failed to start server: {}", e))
    })?;

    service.waiting().await.map_err(|e| {
        Error::Mcp(format!("Service error: {}", e))
    })?;

    Ok(())
}

/// Run the MCP server over streamable HTTP/SSE.
///
/// Per-session credentials AND platform are supplied by the MCP client via request headers:
///   - `X-Datto-Api-Key`    — DRMM API key
///   - `X-Datto-Api-Secret` — DRMM API secret
///   - `X-Datto-Platform`   — platform name (e.g. vidal, pinotage); falls back to `default_platform`
///
/// No DRMM credentials are stored at the server level.
///
/// Auth flow:
///   1. MCP client sends POST /mcp with the three headers above
///   2. Axum middleware authenticates against DRMM and stashes a `DattoClient` in a queue
///   3. `StreamableHttpService` factory pops the client and creates a `DattoRmmServer`
///   4. The session (and its client) lives until the connection is terminated
pub async fn run_server_sse(
    default_platform: Option<datto_api::Platform>,
    agent_id: String,
    port: u16,
    base_url: Option<String>,
) -> Result<()> {
    use axum::{
        body::Body,
        extract::State,
        http::{HeaderMap, Request, StatusCode},
        middleware::{self, Next},
        response::{IntoResponse, Response},
        routing::get,
        Router,
    };
    use rmcp::transport::streamable_http_server::{
        session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
    };
    use std::collections::VecDeque;

    // Credential queue: middleware pushes an authenticated DattoClient; factory pops it.
    // The queue is protected by a std::sync::Mutex (not tokio) because the factory is sync.
    let client_queue: Arc<std::sync::Mutex<VecDeque<DattoClient>>> =
        Arc::new(std::sync::Mutex::new(VecDeque::new()));

    let factory_queue = client_queue.clone();
    let agent_id_for_factory = agent_id.clone();

    // Called once per new MCP session (on Initialize). Pops the pre-created DattoClient
    // that the auth middleware pushed just before this request reached the factory.
    let factory = move || -> std::result::Result<DattoRmmServer, std::io::Error> {
        let client = factory_queue
            .lock()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?
            .pop_front()
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    "No authenticated client — missing X-Datto-Api-Key / X-Datto-Api-Secret headers",
                )
            })?;
        Ok(DattoRmmServer::with_client(client, agent_id_for_factory.as_str()))
    };

    // Disable the session keep-alive timeout. The default (5 min) kills idle session
    // workers without removing the handle from the sessions map, so the next request
    // hits a dead channel and gets a 500 instead of the spec-required 404 that would
    // let Claude reconnect cleanly. For a local process, zombie sessions are harmless
    // — they are cleaned up when the process exits.
    let mut session_manager = LocalSessionManager::default();
    session_manager.session_config.keep_alive = None;
    let session_manager = Arc::new(session_manager);

    let mcp_service = StreamableHttpService::new(
        factory,
        session_manager,
        // Disable the localhost-only default so ALB can reach the container.
        StreamableHttpServerConfig::default().disable_allowed_hosts(),
    );

    // Auth middleware: extracts credentials from request headers, creates a DattoClient,
    // and pushes it to the queue before forwarding to StreamableHttpService.
    #[derive(Clone)]
    struct AuthState {
        queue: Arc<std::sync::Mutex<VecDeque<DattoClient>>>,
        default_platform: Option<datto_api::Platform>,
        base_url: Option<String>,
    }

    let auth_state = AuthState {
        queue: client_queue,
        default_platform,
        base_url,
    };

    async fn per_session_auth(
        State(state): State<AuthState>,
        headers: HeaderMap,
        request: Request<Body>,
        next: Next,
    ) -> Response {
        let api_key = match headers
            .get("x-datto-api-key")
            .and_then(|v| v.to_str().ok())
        {
            Some(k) => k.to_string(),
            None => {
                return (StatusCode::UNAUTHORIZED, "Missing X-Datto-Api-Key header")
                    .into_response()
            }
        };

        let api_secret = match headers
            .get("x-datto-api-secret")
            .and_then(|v| v.to_str().ok())
        {
            Some(s) => s.to_string(),
            None => {
                return (StatusCode::UNAUTHORIZED, "Missing X-Datto-Api-Secret header")
                    .into_response()
            }
        };

        // Platform: per-session header takes precedence over server default
        let platform = match headers
            .get("x-datto-platform")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.parse::<datto_api::Platform>())
        {
            Some(Ok(p)) => p,
            Some(Err(_)) => {
                return (StatusCode::BAD_REQUEST, "Invalid X-Datto-Platform header").into_response()
            }
            None => match state.default_platform {
                Some(p) => p,
                None => {
                    return (StatusCode::BAD_REQUEST, "Missing X-Datto-Platform header")
                        .into_response()
                }
            },
        };

        match DattoClient::new_with_base_url(
            platform,
            datto_api::Credentials { api_key, api_secret },
            state.base_url.clone(),
        )
        .await
        {
            Ok(client) => {
                if let Ok(mut q) = state.queue.lock() {
                    q.push_back(client);
                }
                next.run(request).await
            }
            Err(e) => {
                tracing::warn!(error = %e, "Per-session DRMM authentication failed");
                (StatusCode::UNAUTHORIZED, "DRMM authentication failed").into_response()
            }
        }
    }

    let mcp_router = Router::new()
        .fallback_service(mcp_service)
        .layer(middleware::from_fn_with_state(auth_state, per_session_auth));

    let app = Router::new()
        .route("/health", get(health_handler))
        .nest("/mcp", mcp_router);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| Error::Mcp(format!("Failed to bind to {}: {}", addr, e)))?;

    tracing::info!(addr = %addr, agent_id = %agent_id, "MCP SSE server listening");

    axum::serve(listener, app)
        .await
        .map_err(|e| Error::Mcp(format!("Server error: {}", e)))?;

    Ok(())
}

async fn health_handler() -> impl axum::response::IntoResponse {
    axum::response::Json(serde_json::json!({
        "status": "ok",
        "service": "datto-rmm-mcp",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
