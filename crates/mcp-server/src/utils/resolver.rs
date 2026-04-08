/// Utilities for resolving names to UIDs
///
/// Example: Resolve site name "Acme Corp" to site UID "abc123"
use crate::Result;
use tracing::debug;

/// Resolve a site name or UID to a UID
pub async fn resolve_site(client: &datto_api::DattoClient, site: &str) -> Result<String> {
    // If it looks like a UID (long, alphanumeric), assume it's already a UID
    if site.len() >= 20 && site.chars().all(|c| c.is_alphanumeric() || c == '-') {
        debug!("Treating '{}' as site UID", site);
        return Ok(site.to_string());
    }

    // Otherwise, search for the site by name
    debug!("Searching for site by name: '{}'", site);
    let sites_res = client.list_sites(Some(datto_api::PaginationQuery {
        page: None,
        max: None,
    })).await
    .map_err(|e| crate::Error::Api(format!("Failed to list sites: {}", e)))?;

    let sites = sites_res.sites.unwrap_or_default();
    debug!("Found {} total sites", sites.len());

    // Try exact case-insensitive match first
    if let Some(site_obj) = sites.iter().find(|s| {
        s.name.as_ref().map(|n| n.to_lowercase() == site.to_lowercase()).unwrap_or(false)
    }) {
        if let Some(uid) = &site_obj.uid {
            debug!("Found exact match: '{}' -> '{}'", site_obj.name.as_ref().unwrap(), uid);
            return Ok(uid.clone());
        }
    }

    // Try partial match (contains)
    if let Some(site_obj) = sites.iter().find(|s| {
        s.name.as_ref().map(|n| n.to_lowercase().contains(&site.to_lowercase())).unwrap_or(false)
    }) {
        if let Some(uid) = &site_obj.uid {
            debug!("Found partial match: '{}' -> '{}'", site_obj.name.as_ref().unwrap(), uid);
            return Ok(uid.clone());
        }
    }

    // Not found - provide helpful error with available sites
    let available: Vec<String> = sites.iter()
        .filter_map(|s| s.name.as_ref().map(|n| n.clone()))
        .take(10)
        .collect();
    
    let suggestion = if available.is_empty() {
        "No sites found in account.".to_string()
    } else {
        format!("Available sites (showing first 10): {}", available.join(", "))
    };

    Err(crate::Error::NotFound(format!("Site not found: '{}'. {}", site, suggestion)))
}

/// Resolve a device name, UID, or MAC address to a UID
pub async fn resolve_device(
    client: &datto_api::DattoClient,
    device: &str,
    site: Option<&str>,
) -> Result<String> {
    // If it looks like a UID (long, alphanumeric), assume it's already a UID
    if device.len() >= 20 && device.chars().all(|c| c.is_alphanumeric() || c == '-') {
        debug!("Treating '{}' as device UID", device);
        return Ok(device.to_string());
    }

    // If it looks like a MAC address (12 hex chars or colon-separated), try MAC lookup first
    let normalized_mac = device.replace(":", "").replace("-", "").to_uppercase();
    if normalized_mac.len() == 12 && normalized_mac.chars().all(|c| c.is_ascii_hexdigit()) {
        debug!("Attempting MAC address lookup for '{}'", device);
        match client.get_device_by_mac(&normalized_mac).await {
            Ok(dev) => {
                if let Some(uid) = dev.uid {
                    debug!("Found device by MAC address: {:?}", dev.hostname);
                    return Ok(uid);
                }
            }
            Err(e) => {
                debug!("MAC lookup failed: {}, falling back to hostname search", e);
            }
        }
    }

    // If site is provided, search within that site first
    if let Some(site_uid) = site {
        debug!("Searching for device '{}' within site '{}'", device, site_uid);
        let devices_res = client.list_site_devices(site_uid, Some(datto_api::PaginationQuery {
            page: None,
            max: None,
        })).await
        .map_err(|e| crate::Error::Api(format!("Failed to list site devices: {}", e)))?;

        let devices = devices_res.devices.unwrap_or_default();
        
        // Try exact hostname match (case-insensitive)
        if let Some(dev) = devices.iter().find(|d| {
            d.hostname.as_ref().map(|h| h.to_lowercase() == device.to_lowercase()).unwrap_or(false)
        }) {
            if let Some(uid) = &dev.uid {
                debug!("Found exact hostname match in site: '{}'", dev.hostname.as_ref().unwrap());
                return Ok(uid.clone());
            }
        }

        // Try partial hostname match
        if let Some(dev) = devices.iter().find(|d| {
            d.hostname.as_ref().map(|h| h.to_lowercase().contains(&device.to_lowercase())).unwrap_or(false)
        }) {
            if let Some(uid) = &dev.uid {
                debug!("Found partial hostname match in site: '{}'", dev.hostname.as_ref().unwrap());
                return Ok(uid.clone());
            }
        }
    }

    // Search account-wide
    debug!("Searching for device '{}' account-wide", device);
    let devices_res = client.list_devices(Some(datto_api::PaginationQuery {
        page: None,
        max: None,
    })).await
    .map_err(|e| crate::Error::Api(format!("Failed to list devices: {}", e)))?;

    let devices = devices_res.devices.unwrap_or_default();

    // Try exact hostname match
    if let Some(dev) = devices.iter().find(|d| {
        d.hostname.as_ref().map(|h| h.to_lowercase() == device.to_lowercase()).unwrap_or(false)
    }) {
        if let Some(uid) = &dev.uid {
            debug!("Found exact hostname match: '{}'", dev.hostname.as_ref().unwrap());
            return Ok(uid.clone());
        }
    }

    // Try partial match
    if let Some(dev) = devices.iter().find(|d| {
        d.hostname.as_ref().map(|h| h.to_lowercase().contains(&device.to_lowercase())).unwrap_or(false)
    }) {
        if let Some(uid) = &dev.uid {
            debug!("Found partial hostname match: '{}'", dev.hostname.as_ref().unwrap());
            return Ok(uid.clone());
        }
    }

    // Not found - provide helpful error
    let suggestion = if site.is_some() {
        format!("Device not found in specified site or account-wide: '{}'", device)
    } else {
        format!("Device not found: '{}'", device)
    };

    Err(crate::Error::NotFound(suggestion))
}
