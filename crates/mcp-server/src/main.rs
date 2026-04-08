use anyhow::Result;
use clap::Parser;
use datto_rmm_mcp_server::{config::Config, server::run_server};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Parser, Debug)]
#[command(
    name = "datto-rmm-mcp",
    about = "MCP server for Datto RMM",
    version
)]
struct Cli {
    /// Datto platform (e.g., pinotage, concord)
    #[arg(long, env = "DATTO_PLATFORM")]
    platform: Option<String>,

    /// Datto API key
    #[arg(long, env = "DATTO_API_KEY")]
    api_key: Option<String>,

    /// Datto API secret
    #[arg(long, env = "DATTO_API_SECRET")]
    api_secret: Option<String>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, env = "RUST_LOG", default_value = "info")]
    log_level: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env file if present
    dotenvy::dotenv().ok();

    // Parse CLI arguments
    let cli = Cli::parse();

    // Initialize tracing/logging
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(&cli.log_level));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stderr))
        .init();

    tracing::info!("Starting Datto RMM MCP Server");

    // Load configuration
    let config = Config::from_cli(cli.platform, cli.api_key, cli.api_secret)?;

    tracing::info!(
        platform = %config.platform(),
        "Configuration loaded"
    );

    // Run the MCP server
    run_server(config).await?;

    Ok(())
}
