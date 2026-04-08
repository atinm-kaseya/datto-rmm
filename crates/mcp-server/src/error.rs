use rmcp::ErrorData as McpError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Not implemented: {0}")]
    NotImplemented(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("MCP error: {0}")]
    Mcp(String),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

pub type Result<T> = std::result::Result<T, Error>;

impl From<Error> for McpError {
    fn from(err: Error) -> Self {
        match err {
            Error::NotFound(msg) => McpError::resource_not_found(msg, None),
            Error::InvalidInput(msg) => McpError::invalid_params(msg, None),
            Error::NotImplemented(msg) => McpError::internal_error(format!("Not implemented: {}", msg), None),
            _ => McpError::internal_error(err.to_string(), None),
        }
    }
}
