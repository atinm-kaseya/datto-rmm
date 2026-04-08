use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::{DattoClient, Priority};
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

// ============================================================================
// get-site-health
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct GetSiteHealthParams {
    #[schemars(description = "Site name or UID")]
    pub site: String,

    #[schemars(description = "Include full device details (vs summary)")]
    #[serde(default)]
    pub include_device_details: bool,
}

pub fn get_site_health_tool() -> Tool {
    tool_helpers::create_tool::<GetSiteHealthParams>(
        "get-site-health",
        "🌟 Tier 1: Complete site health dashboard. Shows device statistics, alert summary, \
         top devices with issues, network config, and recommended actions. \
         Primary entry point after identifying problem sites.",
    )
}

pub fn get_site_health_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: GetSiteHealthParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Step 1: Resolve site UID (if name provided, search for it)
            let site_uid = crate::utils::resolver::resolve_site(&client, &params.site).await?;

            // Step 2: Fetch site data in parallel
            let site_fut = client.get_site(&site_uid);
            let devices_fut = client.list_site_devices(&site_uid, Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            }));
            let alerts_fut = client.list_site_open_alerts(&site_uid, Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            }));
            let settings_fut = client.get_site_settings(&site_uid);
            let variables_fut = client.list_site_variables(&site_uid, Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            }));

            let (site_res, devices_res, alerts_res, settings_res, variables_res) = tokio::join!(
                site_fut, devices_fut, alerts_fut, settings_fut, variables_fut
            );

            let site = site_res.map_err(|e| crate::Error::Api(format!("Failed to get site: {}", e)))?;
            let devices_data = devices_res.map_err(|e| crate::Error::Api(format!("Failed to get devices: {}", e)))?;
            let alerts_data = alerts_res.map_err(|e| crate::Error::Api(format!("Failed to get alerts: {}", e)))?;
            let settings = settings_res.ok(); // Settings optional
            let variables_data = variables_res.ok(); // Variables optional

            // Debug logging to diagnose device count issues
            tracing::debug!(
                "Site health for {}: devices field present: {}, count: {}",
                site_uid,
                devices_data.devices.is_some(),
                devices_data.devices.as_ref().map(|d| d.len()).unwrap_or(0)
            );

            let devices = devices_data.devices.unwrap_or_default();
            let alerts = alerts_data.alerts.unwrap_or_default();
            let variables = variables_data.and_then(|v| v.variables).unwrap_or_default();

            // Aggregate device statistics
            let online_devices = devices.iter().filter(|d| d.online.unwrap_or(false)).count();
            let offline_devices = devices.len() - online_devices;

            // Group devices by type
            let mut devices_by_type: std::collections::HashMap<String, (usize, usize)> = std::collections::HashMap::new();
            for device in &devices {
                let device_type = device.device_type
                    .as_ref()
                    .and_then(|dt| dt.r#type.clone())
                    .unwrap_or_else(|| "Unknown".to_string());
                
                let entry = devices_by_type.entry(device_type).or_insert((0, 0));
                if device.online.unwrap_or(false) {
                    entry.0 += 1;
                } else {
                    entry.1 += 1;
                }
            }

            // Alert statistics
            let critical_alerts = alerts.iter().filter(|a| matches!(a.priority, Some(Priority::Critical))).count();
            let warning_alerts = alerts.iter().filter(|a| matches!(a.priority, Some(Priority::High) | Some(Priority::Moderate))).count();

            // Group alerts by type (extract from diagnostics)
            let mut alerts_by_type: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
            for alert in &alerts {
                let alert_type = if let Some(diagnostics) = &alert.diagnostics {
                    // Extract category (first part before colon or dash)
                    if let Some(idx) = diagnostics.find(':') {
                        diagnostics[..idx].trim().to_string()
                    } else if let Some(idx) = diagnostics.find(" -") {
                        diagnostics[..idx].trim().to_string()
                    } else {
                        diagnostics.chars().take(30).collect::<String>()
                    }
                } else if let Some(priority) = &alert.priority {
                    format!("{:?}", priority)
                } else {
                    "Unknown".to_string()
                };
                *alerts_by_type.entry(alert_type).or_insert(0) += 1;
            }

            // Find top devices with alerts
            let mut alerts_by_device: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
            for alert in &alerts {
                if let Some(device_uid) = alert.alert_source_info.as_ref().and_then(|info| info.device_uid.as_ref()) {
                    *alerts_by_device.entry(device_uid.clone()).or_insert(0) += 1;
                }
            }

            let mut device_alert_counts: Vec<_> = alerts_by_device.iter().map(|(k, v)| (k.clone(), *v)).collect();
            device_alert_counts.sort_by(|a, b| b.1.cmp(&a.1));
            let top_devices: Vec<_> = device_alert_counts.iter().take(5).collect();

            // Build response
            let mut lines = Vec::new();

            lines.push(format!("# Site Health: {}", site.name.as_deref().unwrap_or("Unknown Site")));
            lines.push(String::new());
            lines.push(format!("**Site UID:** `{}`", site_uid));
            lines.push(format!("**Status:** {}", if site.on_demand.unwrap_or(false) { "⚡ On-Demand" } else { "✅ Active" }));
            lines.push(String::new());

            // Device overview
            lines.push("## 📊 Devices".to_string());
            lines.push(String::new());
            lines.push(format!("**Total:** {} ({} online, {} offline)", devices.len(), online_devices, offline_devices));
            
            // Diagnostic: Show site.devices_status if it differs from actual count
            if let Some(status) = &site.devices_status {
                if let Some(reported_count) = status.number_of_devices {
                    if reported_count as usize != devices.len() {
                        lines.push(String::new());
                        lines.push(format!(
                            "_Note: Site object reports {} devices, but device list API returned {}. Using actual device list._",
                            reported_count, devices.len()
                        ));
                    }
                }
            }
            
            lines.push(String::new());

            if !devices_by_type.is_empty() {
                lines.push("**Device Breakdown:**".to_string());
                let mut type_vec: Vec<_> = devices_by_type.iter().collect();
                type_vec.sort_by(|a, b| (b.1.0 + b.1.1).cmp(&(a.1.0 + a.1.1)));
                
                for (device_type, (online, offline)) in type_vec {
                    let total = online + offline;
                    let offline_note = if *offline > 0 { format!(", {} offline", offline) } else { String::new() };
                    lines.push(format!("- {}: {} ({} online{})", device_type, total, online, offline_note));
                }
                lines.push(String::new());
            }

            // Alert overview
            if !alerts.is_empty() {
                lines.push("## ⚠️  Open Alerts".to_string());
                lines.push(String::new());
                lines.push(format!("**Total:** {} ({} critical, {} warnings)", alerts.len(), critical_alerts, warning_alerts));
                lines.push(String::new());

                // Top alert types
                if !alerts_by_type.is_empty() {
                    lines.push("**Alert Types:**".to_string());
                    let mut type_vec: Vec<_> = alerts_by_type.iter().collect();
                    type_vec.sort_by(|a, b| b.1.cmp(a.1));
                    
                    for (alert_type, count) in type_vec.iter().take(5) {
                        lines.push(format!("- {}: {}", alert_type, count));
                    }
                    lines.push(String::new());
                }

                // Top devices with alerts
                if !top_devices.is_empty() {
                    lines.push("## 🔴 Top Devices With Alerts".to_string());
                    lines.push(String::new());
                    
                    for (index, (device_uid, alert_count)) in top_devices.iter().enumerate() {
                        let device = devices.iter().find(|d| d.uid.as_ref() == Some(device_uid));
                        let hostname = device.and_then(|d| d.hostname.as_ref()).map(|s| s.as_str()).unwrap_or("Unknown");
                        let status_icon = if device.and_then(|d| d.online).unwrap_or(false) { "🟢" } else { "📵" };
                        
                        lines.push(format!("{}. {} **{}** - {} alert{}", 
                            index + 1, status_icon, hostname, alert_count, if *alert_count > 1 { "s" } else { "" }));
                        lines.push(format!("   - Device UID: `{}`", device_uid));
                    }
                    lines.push(String::new());
                }
            } else {
                lines.push("## ✅ No Open Alerts".to_string());
                lines.push(String::new());
            }

            // Network configuration
            if let Some(ref settings) = settings {
                if let Some(proxy) = &settings.proxy_settings {
                    if proxy.host.is_some() {
                        lines.push("## 🌐 Network Configuration".to_string());
                        lines.push(String::new());
                        let proxy_type = proxy.r#type.as_ref()
                            .map(|t| match t {
                                datto_api::proxy_settings::Type::Http => "HTTP",
                                datto_api::proxy_settings::Type::Socks4 => "SOCKS4",
                                datto_api::proxy_settings::Type::Socks5 => "SOCKS5",
                            })
                            .unwrap_or("unknown");
                        lines.push(format!("**Proxy:** {}:{} ({})", 
                            proxy.host.as_deref().unwrap_or(""),
                            proxy.port.map(|p| p.to_string()).unwrap_or_default(),
                            proxy_type));
                        lines.push(String::new());
                    }
                }
            }

            // Site variables
            if !variables.is_empty() {
                lines.push("## 🔧 Site Variables".to_string());
                lines.push(String::new());
                lines.push(format!("{} configured", variables.len()));
                lines.push(String::new());
            }

            // Device details (if requested)
            if params.include_device_details && !devices.is_empty() {
                lines.push("## 📋 All Devices".to_string());
                lines.push(String::new());
                
                // Sort: offline first, then by alert count (descending), then by name
                let mut sorted_devices: Vec<_> = devices.iter().collect();
                sorted_devices.sort_by(|a, b| {
                    let a_online = a.online.unwrap_or(false);
                    let b_online = b.online.unwrap_or(false);
                    if a_online != b_online {
                        return if a_online { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Less };
                    }
                    
                    let a_alerts = alerts_by_device.get(a.uid.as_ref().unwrap_or(&String::new())).copied().unwrap_or(0);
                    let b_alerts = alerts_by_device.get(b.uid.as_ref().unwrap_or(&String::new())).copied().unwrap_or(0);
                    if a_alerts != b_alerts {
                        return b_alerts.cmp(&a_alerts);
                    }
                    
                    let a_name = a.hostname.as_deref().unwrap_or("");
                    let b_name = b.hostname.as_deref().unwrap_or("");
                    a_name.cmp(b_name)
                });

                for device in sorted_devices.iter().take(20) {
                    let status_icon = if device.online.unwrap_or(false) { "🟢" } else { "📵" };
                    let device_alert_count = alerts_by_device.get(device.uid.as_ref().unwrap_or(&String::new())).copied().unwrap_or(0);
                    let alert_text = if device_alert_count > 0 {
                        format!(" - {} alert{}", device_alert_count, if device_alert_count > 1 { "s" } else { "" })
                    } else {
                        String::new()
                    };
                    
                    let device_type = device.device_type.as_ref()
                        .and_then(|dt| dt.r#type.as_ref())
                        .map(|t| t.as_str())
                        .unwrap_or("Unknown");
                    
                    lines.push(format!("- {} **{}** ({}){}", 
                        status_icon, 
                        device.hostname.as_deref().unwrap_or("Unknown"),
                        device_type,
                        alert_text
                    ));
                    lines.push(format!("  - UID: `{}`", device.uid.as_deref().unwrap_or("Unknown")));
                }
                
                if sorted_devices.len() > 20 {
                    lines.push(String::new());
                    lines.push(format!("_...and {} more devices_", sorted_devices.len() - 20));
                }
                
                lines.push(String::new());
            }

            // Recommendations
            lines.push("## 💡 Recommended Actions".to_string());
            lines.push(String::new());
            
            let mut action_num = 1;
            
            if offline_devices > 0 {
                lines.push(format!("{}. **Check offline devices**: Use `list-site-devices` with status filter", action_num));
                lines.push("   ```json".to_string());
                lines.push(format!("   {{ \"site\": \"{}\", \"status\": \"offline\" }}", site_uid));
                lines.push("   ```".to_string());
                lines.push(String::new());
                action_num += 1;
            }

            if !top_devices.is_empty() {
                if let Some((top_device_uid, _)) = top_devices.first() {
                    let device = devices.iter().find(|d| d.uid.as_ref() == Some(top_device_uid));
                    if let Some(hostname) = device.and_then(|d| d.hostname.as_ref()) {
                        lines.push(format!("{}. **Investigate top device**: `get-device-health` on **{}**", action_num, hostname));
                        lines.push("   ```json".to_string());
                        lines.push(format!("   {{ \"device\": \"{}\", \"site\": \"{}\" }}", top_device_uid, site_uid));
                        lines.push("   ```".to_string());
                        lines.push(String::new());
                        action_num += 1;
                    }
                }
            }

            if critical_alerts > 5 {
                lines.push(format!("{}. **Alert analysis**: Use `get-site-alerts` for grouped view", action_num));
                lines.push("   ```json".to_string());
                lines.push(format!("   {{ \"site\": \"{}\", \"group_by\": \"type\" }}", site_uid));
                lines.push("   ```".to_string());
                lines.push(String::new());
            }

            if action_num == 1 {
                lines.push("- Site is healthy - no immediate actions needed".to_string());
            }

            let result_data = serde_json::json!({
                "site_uid": &site_uid,
                "site": serde_json::to_value(&site).unwrap(),
                "devices": serde_json::to_value(&devices).unwrap(),
                "alerts": serde_json::to_value(&alerts).unwrap(),
                "settings": serde_json::to_value(&settings).unwrap(),
                "variables": serde_json::to_value(&variables).unwrap(),
                "analysis": {
                    "total_devices": devices.len(),
                    "online_devices": online_devices,
                    "offline_devices": offline_devices,
                    "devices_by_type": &devices_by_type,
                    "critical_alerts": critical_alerts,
                    "warning_alerts": warning_alerts,
                    "total_alerts": alerts.len()
                }
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this comprehensive site health dashboard. Start with site name as heading. Show device statistics prominently - consider using a pie chart or donut chart for device status (online vs offline breakdown). Group devices by type showing online/offline counts for each type - could use horizontal bar chart. Display alert summary with severity breakdown - use pie chart or donut chart for critical vs warnings distribution, or progress bars with color coding (red for critical, yellow for warnings). List top devices needing attention sorted by offline status first, then alert count - show device name, status icon, type, and alert count. Include settings information if available (proxy config, email recipients). List site variables with masked sensitive values. End with recommended actions based on issues found - suggest checking offline devices or investigating top problem devices, or note site is healthy. Make this dashboard visually rich and scannable at a glance with charts and visual indicators.",
                Some(vec!["dashboard_layout", "pie_charts", "donut_charts", "progress_bars", "device_statistics", "type_grouping", "bar_charts", "alert_summary", "health_visualizations", "top_devices_ranking", "configuration_details", "actionable_recommendations", "visual_hierarchy"])
            ))
        })
    })
}

// ============================================================================
// list-site-devices (Tier 1 composite version)
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct ListSiteDevicesParams {
    #[schemars(description = "Site identifier: name or UID")]
    pub site: String,

    #[schemars(description = "Filter by online status (default: all)")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[schemars(description = "Filter by device type (desktop, laptop, server, etc.)")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,

    #[schemars(description = "Only show devices with open alerts (default: false)")]
    #[serde(default)]
    pub has_alerts: bool,

    #[schemars(description = "Sort order: name, alerts, last_seen (default: name)")]
    #[serde(default = "default_sort_by")]
    pub sort_by: String,
}

fn default_sort_by() -> String {
    "name".to_string()
}

pub fn list_site_devices_tool() -> Tool {
    tool_helpers::create_tool::<ListSiteDevicesParams>(
        "list-site-devices",
        "🌟 [Tier 1] Browse and filter devices within a site with rich formatting.",
    )
}

pub fn list_site_devices_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: ListSiteDevicesParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Resolve site UID
            let site_uid = crate::utils::resolver::resolve_site(&client, &params.site).await?;

            // Fetch devices and optionally alerts
            let devices_fut = client.list_site_devices(&site_uid, Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            }));

            let devices_res = devices_fut.await
                .map_err(|e| crate::Error::Api(format!("Failed to fetch devices: {}", e)))?;

            let mut devices = devices_res.devices.unwrap_or_default();

            // Fetch alerts if needed
            let mut alert_counts = std::collections::HashMap::new();
            if params.has_alerts {
                let alerts_res = client.list_site_open_alerts(&site_uid, Some(datto_api::PaginationQuery {
                    page: None,
                    max: None,
                })).await
                .map_err(|e| crate::Error::Api(format!("Failed to fetch alerts: {}", e)))?;

                let alerts = alerts_res.alerts.unwrap_or_default();
                for alert in alerts {
                    if let Some(device_uid) = alert.alert_source_info.as_ref().and_then(|info| info.device_uid.as_ref()) {
                        *alert_counts.entry(device_uid.clone()).or_insert(0) += 1;
                    }
                }
            }

            // Apply status filter
            if let Some(status) = &params.status {
                let status_lower = status.to_lowercase();
                devices.retain(|d| {
                    match status_lower.as_str() {
                        "online" => d.online.unwrap_or(false),
                        "offline" => !d.online.unwrap_or(false),
                        _ => true,
                    }
                });
            }

            // Apply type filter
            if let Some(type_filter) = &params.r#type {
                let type_lower = type_filter.to_lowercase();
                devices.retain(|d| {
                    d.device_type.as_ref()
                        .and_then(|dt| dt.r#type.as_ref())
                        .map(|t| t.to_lowercase().contains(&type_lower))
                        .unwrap_or(false)
                });
            }

            // Apply has_alerts filter
            if params.has_alerts {
                devices.retain(|d| {
                    d.uid.as_ref()
                        .map(|uid| alert_counts.get(uid).copied().unwrap_or(0) > 0)
                        .unwrap_or(false)
                });
            }

            // Sort devices
            devices.sort_by(|a, b| {
                match params.sort_by.as_str() {
                    "alerts" => {
                        let a_count = a.uid.as_ref().and_then(|uid| alert_counts.get(uid).copied()).unwrap_or(0);
                        let b_count = b.uid.as_ref().and_then(|uid| alert_counts.get(uid).copied()).unwrap_or(0);
                        b_count.cmp(&a_count) // Descending
                    }
                    "last_seen" => {
                        let a_time = a.last_seen.unwrap_or(0);
                        let b_time = b.last_seen.unwrap_or(0);
                        b_time.cmp(&a_time) // Most recent first
                    }
                    _ => { // "name"
                        let a_name = a.hostname.as_deref().unwrap_or("");
                        let b_name = b.hostname.as_deref().unwrap_or("");
                        a_name.cmp(b_name)
                    }
                }
            });

            // Build response
            let mut lines = vec![
                format!("# Devices: {}", params.site),
                String::new(),
            ];

            if devices.is_empty() {
                lines.push("No devices found matching the specified filters.".to_string());
                lines.push(String::new());
                lines.push("💡 **Try:**".to_string());
                lines.push("- Remove filters to see all devices".to_string());
                lines.push("- Check if the site has any devices registered".to_string());
                
                let result_data = serde_json::json!({
                    "site": &params.site,
                    "filters": {
                        "status": &params.status,
                        "type": &params.r#type,
                        "has_alerts": params.has_alerts
                    },
                    "devices": [],
                    "total_count": 0
                });
                
                return Ok(tool_helpers::instructed_result(
                    result_data,
                    "Present a clear 'no results' message for this device search. Show the site name, explain no devices matched the filters, and provide helpful suggestions: try removing filters or check if the site has registered devices. Keep it  brief and actionable.",
                    Some(vec!["no_results_message", "helpful_suggestions"])
                ));
            }

            lines.push(format!("Found **{}** device{}", devices.len(), if devices.len() != 1 { "s" } else { "" }));

            // Add filter summary
            let mut filters = Vec::new();
            if let Some(status) = &params.status {
                filters.push(format!("Status: {}", status));
            }
            if let Some(type_filter) = &params.r#type {
                filters.push(format!("Type: {}", type_filter));
            }
            if params.has_alerts {
                filters.push("Has alerts".to_string());
            }
            if !filters.is_empty() {
                lines.push(format!("Filters: {}", filters.join(", ")));
            }
            lines.push(String::new());

            // List devices
            for device in &devices {
                let status_icon = if device.online.unwrap_or(false) { "🟢" } else { "🔴" };
                let hostname = device.hostname.as_deref().unwrap_or("Unknown");
                let device_type = device.device_type.as_ref()
                    .and_then(|dt| dt.r#type.as_ref())
                    .map(|t| t.as_str())
                    .unwrap_or("Unknown");
                let os = device.operating_system.as_deref().unwrap_or("Unknown OS");
                let ip = device.int_ip_address.as_deref()
                    .or(device.ext_ip_address.as_deref())
                    .unwrap_or("No IP");

                lines.push(format!("### {} {}", status_icon, hostname));
                lines.push(format!("**Type:** {} | **OS:** {}", device_type, os));
                lines.push(format!("**IP:** {}", ip));

                // Last seen for offline devices
                if !device.online.unwrap_or(false) {
                    if let Some(last_seen) = device.last_seen {
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs() as i64;
                        let hours_ago = (now - last_seen) / 3600;
                        if hours_ago > 0 {
                            lines.push(format!("**Last Seen:** {}h ago", hours_ago));
                        }
                    }
                }

                // Alert summary
                let alert_count = device.uid.as_ref().and_then(|uid| alert_counts.get(uid).copied()).unwrap_or(0);
                if alert_count > 0 {
                    lines.push(format!("🔴 **{} open alert{}**", alert_count, if alert_count != 1 { "s" } else { "" }));
                } else if params.has_alerts {
                    // Only show if we fetched alerts
                    lines.push("✅ No open alerts".to_string());
                }

                lines.push(format!("**Device UID:** `{}`", device.uid.as_deref().unwrap_or("Unknown")));
                lines.push(String::new());
            }

            // Recommendations
            lines.push("---".to_string());
            lines.push(String::new());
            lines.push("💡 **Next Steps:**".to_string());
            lines.push("- Use `get-device-health` for detailed device diagnostics".to_string());
            lines.push("- Use `get-site-alerts` to see all alerts grouped by type or device".to_string());

            let result_data = serde_json::json!({
                "site": &params.site,
                "filters": {
                    "status": &params.status,
                    "type": &params.r#type,
                    "has_alerts": params.has_alerts
                },
                "devices": &devices.iter().map(|d| serde_json::json!({
                    "uid": d.uid,
                    "hostname": d.hostname,
                    "online": d.online,
                    "device_type": d.device_type,
                    "operating_system": d.operating_system,
                    "alert_count": d.uid.as_ref().and_then(|uid| alert_counts.get(uid).copied()).unwrap_or(0)
                })).collect::<Vec<_>>()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this filtered list of site devices. Show site name and device count prominently, include active filter summary. For each device display status icon (green online, red offline), hostname prominently, device type, operating system, and open alert count if any. List devices sorted by importance (offline first, then by alert count). End with next step suggestions - use get-device-health for diagnostics or get-site-alerts for grouped alert view. Make problem devices (offline or with alerts) immediately visible.",
                Some(vec!["device_list", "status_icons", "filter_summary", "priority_sorting", "alert_counts", "next_steps"])
            ))
        })
    })
}

// ============================================================================
// get-site-alerts
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct GetSiteAlertsParams {
    #[schemars(description = "Site identifier: name or UID")]
    pub site: String,

    #[schemars(description = "Filter by severity (default: all)")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,

    #[schemars(description = "Group alerts by device or type (default: type)")]
    #[serde(default = "default_group_by")]
    pub group_by: String,
}

fn default_group_by() -> String {
    "type".to_string()
}

pub fn get_site_alerts_tool() -> Tool {
    tool_helpers::create_tool::<GetSiteAlertsParams>(
        "get-site-alerts",
        "🌟 [Tier 1] Alert overview for a specific site with remediation recommendations.",
    )
}

pub fn get_site_alerts_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: GetSiteAlertsParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Resolve site UID
            let site_uid = crate::utils::resolver::resolve_site(&client, &params.site).await?;

            // Fetch alerts
            let alerts_res = client.list_site_open_alerts(&site_uid, Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            })).await
            .map_err(|e| crate::Error::Api(format!("Failed to fetch alerts: {}", e)))?;

            let mut alerts = alerts_res.alerts.unwrap_or_default();

            //Apply severity filter
            if let Some(severity) = &params.severity {
                let sev_lower = severity.to_lowercase();
                alerts.retain(|a| {
                    a.priority.as_ref().map(|p| {
                        format!("{:?}", p).to_lowercase() == sev_lower
                    }).unwrap_or(false)
                });
            }

            // Group by severity
            let high: Vec<_> = alerts.iter().filter(|a| {
                matches!(a.priority, Some(datto_api::Priority::High) | Some(datto_api::Priority::Critical))
            }).collect();
            let medium: Vec<_> = alerts.iter().filter(|a| {
                matches!(a.priority, Some(datto_api::Priority::Moderate))
            }).collect();
            let low: Vec<_> = alerts.iter().filter(|a| {
                matches!(a.priority, Some(datto_api::Priority::Low))
            }).collect();

            let mut lines = vec![
                format!("# Alerts for Site: {}", params.site),
                String::new(),
                format!("**Total Open Alerts:** {}", alerts.len()),
                format!("- 🔴 High: {}", high.len()),
                format!("- 🟠 Medium: {}", medium.len()),
                format!("- 🟡 Low: {}", low.len()),
                String::new(),
            ];

            if !high.is_empty() {
                lines.push("## 🔴 High/Critical Priority Alerts".to_string());
                for alert in high.iter().take(10) {
                    let message = alert.diagnostics.as_deref().unwrap_or("<no diagnostics>");
                    let device = alert.alert_source_info.as_deref()
                        .and_then(|s| s.device_name.as_deref())
                        .unwrap_or("<no device>");
                    lines.push(format!("- **{}** | {}", message, device));
                }
                lines.push(String::new());
            }

            if !medium.is_empty() && params.severity.is_none() {
                lines.push("## 🟠 Moderate Priority Alerts".to_string());
                for alert in medium.iter().take(5) {
                    let message = alert.diagnostics.as_deref().unwrap_or("<no diagnostics>");
                    let device = alert.alert_source_info.as_deref()
                        .and_then(|s| s.device_name.as_deref())
                        .unwrap_or("<no device>");
                    lines.push(format!("- **{}** | {}", message, device));
                }
                lines.push(String::new());            }

            if alerts.is_empty() {
                lines.push("- No alerts matching criteria".to_string());
            }

            let result_data = serde_json::json!({
                "site": &params.site,
                "group_by": &params.group_by,
                "severity": &params.severity,
                "alerts": &alerts,
                "summary": {
                    "total": alerts.len(),
                    "high_critical": high.len(),
                    "medium": medium.len(),
                    "low": low.len()
                }
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this site alert analysis. Show site name in heading with total alert count. Display severity breakdown prominently - consider using a pie chart or donut chart showing the distribution of critical/high, medium, and low severity alerts. List high/critical priority alerts first with diagnostic message and device name. If no severity filter applied, also show medium priority alerts - could use horizontal bar chart showing alert counts per severity level. Use severity icons for visual clarity (red for high/critical, orange for medium, yellow for low). If no alerts found, note that clearly with a positive indicator.",
                Some(vec!["alert_summary", "pie_charts", "donut_charts", "bar_charts", "severity_breakdown", "priority_listing", "device_context", "visual_hierarchy"])
            ))
        })
    })
}

// ============================================================================
// run-site-component
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct RunSiteComponentParams {
    #[schemars(description = "Site identifier: name or UID")]
    pub site: String,

    #[schemars(description = "Component name or UID")]
    pub component: String,

    #[schemars(description = "Device selection: list of hostnames/UIDs or all")]
    pub devices: String,

    #[schemars(description = "Preview only, don't execute (default: false)")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dry_run: Option<bool>,
}

pub fn run_site_component_tool() -> Tool {
    tool_helpers::create_tool::<RunSiteComponentParams>(
        "run-site-component",
        "🌟 [Tier 1] Execute a component on devices within a site with dry-run support.",
    )
}

pub fn run_site_component_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: RunSiteComponentParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Resolve site UID
            let site_uid = crate::utils::resolver::resolve_site(&client, &params.site).await?;

            // Parse device selection
            let device_selection = if params.devices.to_lowercase() == "all" {
                "all devices in site".to_string()
            } else {
                let device_list: Vec<&str> = params.devices.split(',').map(|s| s.trim()).collect();
                format!("{} devices: {}", device_list.len(), device_list.join(", "))
            };

            let mut lines = vec![
                format!("# Run Component on Site: {}", params.site),
                String::new(),
                format!("**Component:** {}", params.component),
                format!("**Target:** {}", device_selection),
                format!("**Mode:** {}", if params.dry_run.unwrap_or(false) { "🔍 Dry Run (Preview Only)" } else { "▶️  Execute" }),
                String::new(),
            ];

            if params.dry_run.unwrap_or(false) {
                lines.push("## Dry Run Preview".to_string());
                lines.push(String::new());
                lines.push("This would execute the component on the selected devices.".to_string());
                lines.push(String::new());
                lines.push("⚠️  **Note:** Actual component execution requires:".to_string());
                lines.push("1. Component UID resolution".to_string());
                lines.push("2. Device UID resolution for each target".to_string());
                lines.push("3. Job creation via API".to_string());
                lines.push("4. Job monitoring".to_string());
                lines.push(String::new());
                lines.push("Use `dry_run: false` to execute (when API methods are available).".to_string());
            } else {
                lines.push("## Execution Status".to_string());
                lines.push(String::new());
                lines.push("⚠️  Component execution API integration pending.".to_string());
                lines.push(String::new());
                lines.push("**Required API calls:**".to_string());
                lines.push(format!("1. Resolve component '{}' to UID", params.component));
                lines.push(format!("2. Create quick job for site '{}'", site_uid));
                lines.push("3. Monitor job progress".to_string());
                lines.push(String::new());
                lines.push("Use Tier 2 tools for manual component execution:".to_string());
                lines.push("- `list-account-components` to find component UID".to_string());
                lines.push("- `create-quick-job` to execute component (when available)".to_string());
            }

            let result_data = serde_json::json!({
                "site": &params.site,
                "site_uid": &site_uid,
                "component": &params.component,
                "device_selection": &device_selection,
                "dry_run": params.dry_run.unwrap_or(false),
                "status": "pending_implementation"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this component execution plan or preview. Show site name, component name, target device selection, and execution mode (dry run preview or actual execution). If dry run, explain what would happen and list required steps (component resolution, device resolution, job creation, monitoring). If actual execution attempted, note that API integration is pending and suggest using Tier 2 tools for manual execution (list-account-components and create-quick-job). Make the execution mode and status clear.",
                Some(vec!["execution_plan", "dry_run_preview", "pending_implementation", "workaround_suggestions"])
            ))
        })
    })
}

// ============================================================================
// bulk-update-site-devices
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct BulkUpdateSiteDevicesParams {
    #[schemars(description = "Site identifier: name or UID")]
    pub site: String,

    #[schemars(description = "Device selection: list of hostnames/UIDs or all")]
    pub devices: String,

    #[schemars(description = "Updates to apply as JSON")]
    pub updates: serde_json::Value,

    #[schemars(description = "Preview only, don't apply changes (default: true)")]
    #[serde(default = "default_true")]
    pub dry_run: bool,
}

fn default_true() -> bool {
    true
}

pub fn bulk_update_site_devices_tool() -> Tool {
    tool_helpers::create_tool::<BulkUpdateSiteDevicesParams>(
        "bulk-update-site-devices",
        "🌟 [Tier 1] Bulk update device properties with dry-run safety.",
    )
}

pub fn bulk_update_site_devices_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: BulkUpdateSiteDevicesParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Resolve site UID
            let site_uid = crate::utils::resolver::resolve_site(&client, &params.site).await?;

            // Parse device selection
            let device_count = if params.devices.to_lowercase() == "all" {
                // Get actual count
                let devices_res = client.list_site_devices(&site_uid, Some(datto_api::PaginationQuery {
                    page: None,
                    max: None,
                })).await
                .map_err(|e| crate::Error::Api(format!("Failed to count devices: {}", e)))?;
                devices_res.page_details
                    .and_then(|pd| pd.total_count)
                    .unwrap_or(0) as i32
            } else {
                params.devices.split(',').count() as i32
            };

            let mut lines = vec![
                format!("# Bulk Update Devices in Site: {}", params.site),
                String::new(),
                format!("**Target Devices:** {} devices", device_count),
                format!("**Mode:** {}", if params.dry_run { "🔍 Dry Run (Preview Only)" } else { "⚠️  APPLY CHANGES" }),
                String::new(),
                "## Proposed Updates".to_string(),
                String::new(),
            ];

            // Show what updates would be applied
            if let Some(obj) = params.updates.as_object() {
                for (key, value) in obj {
                    lines.push(format!("- **{}**: `{}`", key, value));
                }
            } else {
                lines.push(format!("Updates: `{}`", params.updates));
            }

            lines.push(String::new());

            if params.dry_run {
                lines.push("## Dry Run Preview".to_string());
                lines.push(String::new());
                lines.push(format!("This would update {} devices with the changes shown above.", device_count));
                lines.push(String::new());
                lines.push("✅ No changes applied (dry run mode).".to_string());
                lines.push(String::new());
                lines.push("To apply these changes, set `dry_run: false`.".to_string());
            } else {
                lines.push("## Execution Status".to_string());
                lines.push(String::new());
                lines.push("⚠️  Bulk device update API integration pending.".to_string());
                lines.push(String::new());
                lines.push("**Required API calls:**".to_string());
                lines.push("1. For each device: resolve name to UID".to_string());
                lines.push("2. For each device: PATCH /v2/device/{uid} with updates".to_string());
                lines.push("3. Collect and report results".to_string());
                lines.push(String::new());
                lines.push("⚠️  **Safety:** Always test with `dry_run: true` first.".to_string());
            }

            let result_data = serde_json::json!({
                "site": &params.site,
                "site_uid": &site_uid,
                "devices": &params.devices,
                "device_count": device_count,
                "updates": &params.updates,
                "dry_run": params.dry_run,
                "status": "pending_implementation"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this bulk device update plan or preview. Show site name, target device count, and execution mode (dry run preview or apply changes). Display the proposed updates clearly as key-value pairs. If dry run, explain what would happen and note no changes applied, suggest setting dry_run to false to apply. If actual execution attempted, note that API integration is pending and list required steps (device resolution, PATCH calls for each device, result collection). Always emphasize safety - test with dry run first. Make the execution mode and impact clear.",
                Some(vec!["update_plan", "dry_run_preview", "proposed_changes", "safety_warnings", "pending_implementation"])
            ))
        })
    })
}
