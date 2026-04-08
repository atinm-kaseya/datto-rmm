use crate::{
    config::Config,
    resources,
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

/// MCP server handler for Datto RMM
#[derive(Clone)]
pub struct DattoRmmServer {
    client: Arc<DattoClient>,
    tools: Arc<ToolRegistry>,
}

impl DattoRmmServer {
    pub fn new(client: DattoClient) -> Self {
        Self {
            client: Arc::new(client),
            tools: Arc::new(ToolRegistry::new()),
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
        _context: RequestContext<RoleServer>,
    ) -> std::result::Result<CallToolResult, McpError> {
        let tool_name = &request.name;
        tracing::info!(tool = %tool_name, "Calling tool");

        // Convert Map to Value
        let args = request.arguments.as_ref().map(|m| {
            serde_json::Value::Object(m.clone())
        });

        let result = self
            .tools
            .call_tool(tool_name, &args, self.client.clone())
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

/// Run the MCP server with stdio transport
pub async fn run_server(config: Config) -> Result<()> {
    tracing::info!("Initializing Datto API client");

    // Create Datto API client
    let client = DattoClient::new(
        *config.platform(),
        datto_api::Credentials {
            api_key: config.api_key().to_string(),
            api_secret: config.api_secret().to_string(),
        },
    )
    .await
    .map_err(|e| Error::Api(format!("Failed to create Datto client: {}", e)))?;

    // Create MCP server
    let handler = DattoRmmServer::new(client);

    tracing::info!("Starting MCP server on stdio");

    // Create stdio transport and run server
    let service = handler.serve(stdio()).await.map_err(|e| {
        Error::Mcp(format!("Failed to start server: {}", e))
    })?;

    service.waiting().await.map_err(|e| {
        Error::Mcp(format!("Service error: {}", e))
    })?;

    Ok(())
}
