# datto-api

Auto-generated Rust client for the Datto RMM API.

## Prerequisites

The API client is auto-generated during build using [openapi-generator](https://github.com/OpenAPITools/openapi-generator).

Install openapi-generator:
```bash
brew install openapi-generator
```

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
datto-api = { path = "../path/to/datto-rmm/crates/datto-api" }
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
```

## Code Generation

The API types and models are **automatically generated** when you build the crate:

```bash
cargo build -p datto-api
```

The build script (`build.rs`) will:
1. Read the OpenAPI spec from `specs/datto-rmm-openapi.json`
2. Run `openapi-generator` to create Rust types
3. Generate 115+ model types in `src/generated/models/`
4. Make them available via `datto_api::*`

**Note**: Generated code is created during build and should not be committed to git.

## Quick Start

```rust
use datto_api::{DattoClient, Platform, Credentials, PaginationQuery};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create a client
    let client = DattoClient::new(
        Platform::Merlot,
        Credentials {
            api_key: std::env::var("DATTO_API_KEY")?,
            api_secret: std::env::var("DATTO_API_SECRET")?,
        },
    ).await?;

    // Get account information
    let account = client.get_account().await?;
    println!("Account: {:?}", account.name);

    // List sites
    let sites = client.list_sites(Some(PaginationQuery {
        page: Some(1),
        max: Some(100),
    })).await?;
    println!("Sites: {}", sites.sites.map(|s| s.len()).unwrap_or(0));

    // List devices
    let devices = client.list_devices(None).await?;
    println!("Devices: {}", devices.devices.map(|d| d.len()).unwrap_or(0));

    // List open alerts
    let alerts = client.list_open_alerts(None).await?;
    println!("Alerts: {}", alerts.alerts.map(|a| a.len()).unwrap_or(0));

    Ok(())
}
```

## Available API Methods

The client provides typed methods for all major API endpoints:

### Account Operations
- `get_account()` - Get account information
- `list_sites()` - List all sites
- `list_devices()` - List all devices  
- `list_open_alerts()` - List open alerts
- `list_resolved_alerts()` - List resolved alerts
- `list_components()` - List available components

### Site Operations
- `get_site(uid)` - Get site details
- `list_site_devices(uid)` - List devices in a site
- `list_site_open_alerts(uid)` - List site alerts
- `get_site_settings(uid)` - Get site settings
- `list_site_variables(uid)` - List site variables

### Device Operations
- `get_device(uid)` - Get device details
- `list_device_open_alerts(uid)` - List device alerts
- `get_device_audit(uid)` - Get device audit data
- `get_device_software(uid)` - List installed software

### Alert Operations
- `get_alert(uid)` - Get alert details
- `get_alert_context(uid)` - Get alert context
- `resolve_alert(uid)` - Resolve an alert

### Job Operations
- `get_job(uid)` - Get job details
- `get_job_results(uid)` - Get job results

### Low-Level HTTP Methods

For endpoints not yet wrapped, use the generic HTTP methods:

```rust
// Generic GET request
let response: MyType = client.get("/v2/custom/endpoint").await?;

// GET with query parameters
#[derive(serde::Serialize)]
struct MyQuery {
    page: i32,
    max: i32,
}
let response: MyType = client.get_with_query("/v2/endpoint", &MyQuery { page: 1, max: 100 }).await?;

// POST request
let response: MyType = client.post("/v2/endpoint", &my_body).await?;

// PATCH request
let response: MyType = client.patch("/v2/endpoint", &my_body).await?;

// DELETE request
let response: MyType = client.delete("/v2/endpoint").await?;
```

## Examples

See the `examples/` directory for complete examples:

```bash
# Basic usage
DATTO_PLATFORM=merlot \
DATTO_API_KEY=your_key \
DATTO_API_SECRET=your_secret \
cargo run --example basic
```

## Types

All API types are auto-generated from the OpenAPI specification:

- `Account`, `Site`, `Device`, `Alert`, `Job`, etc.
- `SitesPage`, `DevicesPage`, `AlertsPage` - Paginated responses
- `SiteSettings`, `DeviceAudit`, `JobResults` - Detailed data structures

See the generated documentation for complete type information:

```bash
cargo doc --open -p datto-api
```

    println!("Connected to {}", client.platform());

    // Use the client...
    Ok(())
}
```

## Platforms

The Datto RMM API is hosted on multiple regional platforms:

```rust
use datto_api::Platform;

let platforms = [
    Platform::Pinotage,  // https://pinotage-api.centrastage.net/api
    Platform::Merlot,    // https://merlot-api.centrastage.net/api
    Platform::Concord,   // https://concord-api.centrastage.net/api
    Platform::Vidal,     // https://vidal-api.centrastage.net/api
    Platform::Zinfandel, // https://zinfandel-api.centrastage.net/api
    Platform::Syrah,     // https://syrah-api.centrastage.net/api
    Platform::Sandbox,   // https://sandbox-api.centrastage.net/api (shared sandbox)
    Platform::Devb,      // https://devb-api.centrastage.net/api (dev/test)
    Platform::Staging,   // https://staging-api.centrastage.net/api (staging)
];

// Parse from string
let platform: Platform = "merlot".parse()?;
```

## Authentication

The client uses OAuth 2.0 password grant flow with automatic token management:

- Uses password grant flow (`grant_type=password`)
- Client credentials: `public-client:public`
- Your API key/secret are sent as username/password
- Tokens are cached and reused
- Automatic refresh before expiry (5 minute buffer)
- Thread-safe token state management

**Note**: Your credentials should be REST API user credentials from User Profile → API Settings, 
not OAuth application credentials.

```rust
use datto_api::{DattoClient, Platform, Credentials};

let client = DattoClient::new(
    Platform::Merlot,
    Credentials {
        api_key: "your-api-key".into(),
        api_secret: "your-api-secret".into(),
    },
).await?;

// Get a valid token (refreshes if needed)
let token = client.ensure_token().await?;
```

## Error Handling

```rust
use datto_api::Error;

match client.some_operation().await {
    Ok(result) => println!("Success: {:?}", result),
    Err(Error::Auth(msg)) => eprintln!("Authentication failed: {}", msg),
    Err(Error::HttpClient(e)) => eprintln!("HTTP error: {}", e),
    Err(Error::Api { status, message }) => {
        eprintln!("API error {}: {}", status, message)
    }
}
```

## Building

The Rust client uses `progenitor` to generate API types at build time from the OpenAPI spec.

```bash
# Ensure the spec exists
pnpm sync:openapi

# Build the crate
cargo build -p datto-api
```

## Known Limitations

**OpenAPI 3.1.0 Support**: The Datto RMM API uses OpenAPI 3.1.0, which is not yet fully supported by progenitor. The crate compiles and provides:
- Platform configuration
- OAuth token management
- HTTP client with authentication

However, the auto-generated API types are not available until progenitor adds 3.1.0 support. For now, you can make custom requests using the HTTP client directly.

## License

MIT
