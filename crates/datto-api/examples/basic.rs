//! Example: Get account information and list sites
//!
//! This example demonstrates basic usage of the Datto RMM API client.
//!
//! Usage:
//! ```bash
//! DATTO_PLATFORM=merlot \
//! DATTO_API_KEY=your_api_key \
//! DATTO_API_SECRET=your_api_secret \
//! cargo run --example basic
//! ```

use datto_api::{DattoClient, Platform, Credentials, PaginationQuery};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load configuration from environment
    let platform_str = std::env::var("DATTO_PLATFORM")
        .expect("DATTO_PLATFORM environment variable required");
    let api_key = std::env::var("DATTO_API_KEY")
        .expect("DATTO_API_KEY environment variable required");
    let api_secret = std::env::var("DATTO_API_SECRET")
        .expect("DATTO_API_SECRET environment variable required");

    // Parse platform
    let platform: Platform = platform_str.parse()
        .expect("Invalid platform. Valid: pinotage, merlot, concord, vidal, zinfandel, syrah, sandbox, devb, staging");

    println!("🔌 Connecting to Datto RMM ({})...", platform);

    // Create API client
    let client = DattoClient::new(
        platform,
        Credentials {
            api_key,
            api_secret,
        },
    ).await?;

    println!("✅ Authenticated successfully!\n");

    // Get account information
    println!("📊 Fetching account information...");
    let account = client.get_account().await?;
    println!("   Account: {}", account.name.unwrap_or_else(|| "Unknown".to_string()));
    
    if let Some(status) = account.devices_status {
        println!("   Total devices: {}", status.number_of_devices.unwrap_or(0));
        println!("   Online: {}", status.number_of_online_devices.unwrap_or(0));
        println!("   Offline: {}", status.number_of_offline_devices.unwrap_or(0));
    }
    println!();

    // List sites
    println!("🏢 Fetching sites...");
    let sites_page = client.list_sites(Some(PaginationQuery {
        page: Some(1),
        max: Some(10),
    })).await?;

    if  let Some(sites) = sites_page.sites {
        println!("   Found {} sites (showing first 10):", sites.len());
        for site in sites.iter().take(10) {
            let name = site.name.as_deref().unwrap_or("Unknown");
            let uid = site.uid.as_deref().unwrap_or("N/A");
            
            let device_count = site.devices_status
                .as_ref()
                .and_then(|s| s.number_of_devices)
                .unwrap_or(0);
            
            println!("   - {} (UID: {}) - {} devices", name, uid, device_count);
        }
    } else {
        println!("   No sites found");
    }
    println!();

    // List open alerts
    println!("⚠️  Fetching open alerts...");
    let alerts_page = client.list_open_alerts(Some(PaginationQuery {
        page: Some(1),
        max: Some(5),
    })).await?;

    if let Some(alerts) = alerts_page.alerts {
        println!("   Found {} alerts (showing first 5):", alerts.len());
        for alert in alerts.iter().take(5) {
            let priority = alert.priority.as_deref().unwrap_or("Unknown");
            let diagnostics = alert.diagnostics.as_deref().unwrap_or("No details");
            println!("   - [{}] {}", priority, diagnostics);
        }
    } else {
        println!("   No open alerts");
    }

    println!("\n✨ Done!");
    
    Ok(())
}
