//! Datto RMM API Client
//!
//! Auto-generated Rust client for the Datto RMM REST API.
//!
//! # Example
//!
//! ```no_run
//! use datto_api::{DattoClient, Platform, Credentials};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let client = DattoClient::new(
//!         Platform::Merlot,
//!         Credentials {
//!             api_key: std::env::var("DATTO_API_KEY")?,
//!             api_secret: std::env::var("DATTO_API_SECRET")?,
//!         },
//!     ).await?;
//!
//!     // Use the client...
//!     Ok(())
//! }
//! ```

mod client;
mod platforms;
pub mod api;
pub mod generated;
pub mod mcp_headers;
pub mod serde_helpers;

pub use client::{Credentials, DattoClient, Error};
pub use mcp_headers::McpCallHeaders;
pub use platforms::{Platform, PlatformParseError};

// Re-export commonly used generated types
pub use generated::models::alert::Priority;
pub use api::PaginationQuery;

#[cfg(has_generated_api)]
pub use generated::*;
