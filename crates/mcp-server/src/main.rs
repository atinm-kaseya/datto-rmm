use anyhow::Result;
use clap::{Parser, ValueEnum};
use datto_rmm_mcp_server::server::{run_server_sse, run_server_stdio};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Debug, Clone, ValueEnum, Default)]
enum Transport {
    /// Stdio subprocess — used by Claude Desktop; credentials via DATTO_API_KEY / DATTO_API_SECRET
    /// env vars set in the MCP client config (never in your shell).
    #[default]
    Stdio,
    /// HTTP/SSE — used for remote/ECS deployment; credentials per-session via
    /// X-Datto-Api-Key / X-Datto-Api-Secret request headers.
    Sse,
}

#[derive(Parser, Debug)]
#[command(
    name = "datto-rmm-mcp",
    about = "MCP server for Datto RMM",
    version
)]
struct Cli {
    /// Transport: stdio (Claude Desktop) or sse (remote/ECS)
    #[arg(long, env = "MCP_TRANSPORT", default_value = "stdio")]
    transport: Transport,

    /// Datto platform (e.g., pinotage, sandbox).
    /// For SSE, this is the default; clients can override per-session via X-Datto-Platform header.
    #[arg(long, env = "DATTO_PLATFORM")]
    platform: String,

    /// Agent identifier propagated as X-Datto-Mcp-Agent-Id on every outbound DRMM API call
    #[arg(long, env = "MCP_AGENT_ID", default_value = "datto-rmm-mcp")]
    agent_id: String,

    /// Port to listen on (SSE transport only)
    #[arg(long, env = "MCP_PORT", default_value = "8080")]
    port: u16,

    /// Override the DRMM API base URL (e.g., point at an internal AEM API endpoint)
    #[arg(long, env = "DATTO_BASE_URL")]
    base_url: Option<String>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, env = "RUST_LOG", default_value = "info")]
    log_level: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let cli = Cli::parse();

    // In stdio mode write logs to stderr so stdout stays clean for MCP protocol traffic
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(&cli.log_level));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stderr))
        .init();

    let platform = cli.platform.parse::<datto_api::Platform>()
        .map_err(|e| anyhow::anyhow!("Invalid platform '{}': {}", cli.platform, e))?;

    match cli.transport {
        Transport::Stdio => {
            tracing::info!(platform = %cli.platform, agent_id = %cli.agent_id, "Starting MCP server on stdio");
            run_server_stdio(platform, cli.agent_id, cli.base_url).await?;
        }
        Transport::Sse => {
            tracing::info!(platform = %cli.platform, port = cli.port, agent_id = %cli.agent_id, "Starting MCP SSE server — clients may override platform via X-Datto-Platform header");
            run_server_sse(Some(platform), cli.agent_id, cli.port, cli.base_url).await?;
        }
    }

    Ok(())
}
