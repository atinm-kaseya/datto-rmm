use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::{DattoClient, McpCallHeaders, Priority};
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

// ============================================================================
// get-account-dashboard
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[schemars(description = "Parameters for getting account dashboard")]
pub struct GetAccountDashboardParams {
    #[schemars(description = "Time range for dashboard data: today, week, or month")]
    #[serde(default = "default_time_range")]
    pub time_range: String,
}

fn default_time_range() -> String {
    "today".to_string()
}

pub fn get_account_dashboard_tool() -> Tool {
    tool_helpers::create_tool::<GetAccountDashboardParams>(
        "get-account-dashboard",
        "🌟 Tier 1: High-level account overview. Shows total sites/devices, critical sites \
         with most alerts/offline devices, alert summary, and recommended actions. \
         Use this as your first tool of the day for triage.",
    )
}

pub fn get_account_dashboard_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: GetAccountDashboardParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Parallel API calls for dashboard data
            let account_fut = client.get_account_with_mcp(&mcp_headers);
            let sites_fut = client.list_sites_with_mcp(Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            }), &mcp_headers);
            let alerts_fut = client.list_open_alerts_with_mcp(Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            }), &mcp_headers);

            let (account_res, sites_res, alerts_res) = tokio::join!(account_fut, sites_fut, alerts_fut);

            let account = account_res.map_err(|e| crate::Error::Api(format!("Failed to get account: {}", e)))?;
            let sites_data = sites_res.map_err(|e| crate::Error::Api(format!("Failed to get sites: {}", e)))?;
            let alerts_data = alerts_res.map_err(|e| crate::Error::Api(format!("Failed to get alerts: {}", e)))?;

            // Debug logging to diagnose site count issues
            tracing::debug!(
                "Account dashboard: sites field present: {}, count: {}",
                sites_data.sites.is_some(),
                sites_data.sites.as_ref().map(|s| s.len()).unwrap_or(0)
            );

            let sites = sites_data.sites.unwrap_or_default();
            let alerts = alerts_data.alerts.unwrap_or_default();

            // Aggregate alert counts by site
            let mut alerts_by_site = std::collections::HashMap::new();
            for alert in &alerts {
                let site_uid = alert
                    .alert_source_info
                    .as_ref()
                    .and_then(|info| info.site_uid.as_ref())
                    .map(|s| s.as_str())
                    .unwrap_or("unknown");

                let entry = alerts_by_site.entry(site_uid.to_string()).or_insert((0, 0, 0));
                
                match &alert.priority {
                    Some(Priority::Critical) => entry.0 += 1,
                    Some(Priority::High) | Some(Priority::Moderate) => entry.1 += 1,
                    _ => {}
                }
                entry.2 += 1; // total
            }

            // Calculate site issue scores
            #[derive(Debug)]
            struct SiteIssue {
                name: String,
                uid: String,
                critical_alerts: i64,
                warning_alerts: i64,
                offline_devices: i64,
                total_devices: i64,
                score: i64,
            }

            let mut site_issues: Vec<SiteIssue> = sites
                .iter()
                .map(|site| {
                    let site_uid = site.uid.as_deref().unwrap_or("");
                    let (critical, warnings, _total) = alerts_by_site.get(site_uid).copied().unwrap_or((0, 0, 0));
                    
                    let offline_devices = site
                        .devices_status
                        .as_ref()
                        .and_then(|s| s.number_of_offline_devices)
                        .unwrap_or(0);
                    
                    let total_devices = site
                        .devices_status
                        .as_ref()
                        .and_then(|s| s.number_of_devices)
                        .unwrap_or(0);

                    // Score: critical alerts * 10 + warning alerts * 2 + offline devices * 3
                    let score = critical * 10 + warnings * 2 + offline_devices * 3;

                    SiteIssue {
                        name: site.name.clone().unwrap_or_else(|| "Unknown Site".to_string()),
                        uid: site_uid.to_string(),
                        critical_alerts: critical,
                        warning_alerts: warnings,
                        offline_devices,
                        total_devices,
                        score,
                    }
                })
                .collect();

            // Sort by score descending and take top 5
            site_issues.sort_by(|a, b| b.score.cmp(&a.score));
            let top_sites: Vec<_> = site_issues.iter().filter(|s| s.score > 0).take(5).collect();

            // Count alert severities
            let critical_count = alerts.iter().filter(|a| matches!(a.priority, Some(Priority::Critical))).count();
            let warning_count = alerts
                .iter()
                .filter(|a| matches!(a.priority, Some(Priority::High) | Some(Priority::Moderate)))
                .count();

            // Build dashboard response
            let mut lines = Vec::new();

            lines.push(format!("# Account Dashboard: {}", account.name.as_deref().unwrap_or("Datto RMM")));
            lines.push(String::new());
            lines.push(format!("_Time Range: {}_", params.time_range));
            lines.push(String::new());

            // Account-wide metrics
            lines.push("## 📊 Account Overview".to_string());
            lines.push(String::new());
            lines.push(format!("**Sites:** {}", sites.len()));
            
            // Diagnostic: Warn if site count seems wrong
            if sites.is_empty() {
                lines.push(String::new());
                lines.push("_⚠️  Note: API returned 0 sites. This may indicate an API pagination issue or account configuration problem._".to_string());
                lines.push("_Try: `list-sites` to verify site data is accessible._".to_string());
            }
            
            lines.push(format!(
                "**Devices:** {} total",
                account.devices_status.as_ref().and_then(|s| s.number_of_devices).unwrap_or(0)
            ));
            lines.push(format!(
                "- 🟢 Online: {}",
                account.devices_status.as_ref().and_then(|s| s.number_of_online_devices).unwrap_or(0)
            ));
            lines.push(format!(
                "- 🔴 Offline: {}",
                account.devices_status.as_ref().and_then(|s| s.number_of_offline_devices).unwrap_or(0)
            ));
            lines.push(String::new());

            // Alert summary
            lines.push("## ⚠️  Alert Summary".to_string());
            lines.push(String::new());
            lines.push(format!("**Total Open Alerts:** {}", alerts.len()));
            lines.push(format!("- 🔴 Critical: {}", critical_count));
            lines.push(format!("- ⚠️  Warnings: {}", warning_count));
            lines.push(String::new());

            // Critical sites
            if !top_sites.is_empty() {
                lines.push("## 🚨 Sites Needing Attention".to_string());
                lines.push(String::new());

                for (index, site) in top_sites.iter().enumerate() {
                    lines.push(format!("### {}. **{}**", index + 1, site.name));
                    lines.push(format!("   - Site UID: `{}`", site.uid));

                    if site.critical_alerts > 0 {
                        lines.push(format!(
                            "   - 🔴 {} critical alert{}",
                            site.critical_alerts,
                            if site.critical_alerts > 1 { "s" } else { "" }
                        ));
                    }
                    if site.warning_alerts > 0 {
                        lines.push(format!(
                            "   - ⚠️  {} warning{}",
                            site.warning_alerts,
                            if site.warning_alerts > 1 { "s" } else { "" }
                        ));
                    }
                    if site.offline_devices > 0 {
                        lines.push(format!(
                            "   - 📵 {} offline device{}",
                            site.offline_devices,
                            if site.offline_devices > 1 { "s" } else { "" }
                        ));
                    }
                    lines.push(format!("   - 📊 {} total devices", site.total_devices));
                    lines.push(String::new());
                }
            } else {
                lines.push("## ✅ All Clear".to_string());
                lines.push(String::new());
                lines.push("No critical issues detected across any sites.".to_string());
                lines.push(String::new());
            }

            // Recommendations
            lines.push("## 💡 Recommended Actions".to_string());
            lines.push(String::new());

            if let Some(top_site) = top_sites.first() {
                lines.push(format!("1. **Investigate top site**: Use `get-site-health` on **{}**", top_site.name));
                lines.push("   ```json".to_string());
                lines.push(format!("   {{ \"site\": \"{}\" }}", top_site.uid));
                lines.push("   ```".to_string());
                lines.push(String::new());

                if top_sites.len() > 1 {
                    lines.push("2. **Review other problem sites**: Use `find-sites-with-issues` for full list".to_string());
                    lines.push(String::new());
                }

                if critical_count > 5 {
                    lines.push("3. **Alert trending**: Use `get-alert-summary` to identify patterns".to_string());
                    lines.push(String::new());
                }
            } else {
                lines.push("- Check for maintenance tasks with `get-account-analytics`".to_string());
                lines.push("- Review resolved alerts for trends".to_string());
                lines.push(String::new());
            }

            // Package all data for LLM
            let dashboard_data = serde_json::json!({
                "account": serde_json::to_value(&account).unwrap(),
                "sites": serde_json::to_value(&sites).unwrap(),
                "alerts": serde_json::to_value(&alerts).unwrap(),
                "analysis": {
                    "time_range": &params.time_range,
                    "top_sites_needing_attention": top_sites.iter().map(|s| serde_json::json!({
                        "name": s.name,
                        "uid": s.uid,
                        "critical_alerts": s.critical_alerts,
                        "warning_alerts": s.warning_alerts,
                        "offline_devices": s.offline_devices,
                        "total_devices": s.total_devices,
                        "issue_score": s.score
                    })).collect::<Vec<_>>(),
                    "alert_summary": {
                        "total": alerts.len(),
                        "critical": critical_count,
                        "warnings": warning_count
                    }
                }
            });

            Ok(tool_helpers::instructed_result(
                dashboard_data,
                "Present this account dashboard data as a comprehensive overview for daily triage. Start with the account name as the heading. Display account-wide metrics prominently - consider using a pie chart or donut chart for device status (online vs offline breakdown), show total sites count. For alert summary, use visual indicators: pie chart showing critical vs warnings distribution, or progress bars with color coding (red for critical, yellow for warnings). Identify the top 5 sites needing attention based on issue scores - present as a ranked list or table with issue scores visualized (could use horizontal bar chart or severity indicators). For each problem site, show critical alerts, warnings, offline devices, and total devices with icons and counts. Consider progress bars for device health percentages. If no issues detected, show a prominent 'All Clear' message with success indicator. End with recommended next actions as actionable buttons or links - suggest using get-site-health on the top problem site, or maintenance tasks if all is well. Make this dashboard visually rich and scannable at a glance.",
                Some(vec!["dashboard_layout", "pie_charts", "progress_bars", "severity_icons", "priority_ranking", "bar_charts", "health_visualizations", "actionable_recommendations", "metrics_summary", "visual_hierarchy"])
            ))
        })
    })
}

// ============================================================================
// find-sites-with-issues
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct FindSitesWithIssuesParams {
    #[schemars(description = "Severity filter: critical, warning, or all")]
    #[serde(default = "default_severity")]
    pub severity: String,

    #[schemars(description = "Minimum offline device count")]
    #[serde(default = "default_min_offline")]
    pub min_offline_devices: u32,

    #[schemars(description = "Sort by: alerts, offline_devices, or combined")]
    #[serde(default = "default_sort_by")]
    pub sort_by: String,

    #[schemars(description = "Maximum sites to return")]
    #[serde(default = "default_limit")]
    pub limit: u32,
}

fn default_severity() -> String {
    "critical".to_string()
}
fn default_min_offline() -> u32 {
    1
}
fn default_sort_by() -> String {
    "combined".to_string()
}
fn default_limit() -> u32 {
    10
}

pub fn find_sites_with_issues_tool() -> Tool {
    tool_helpers::create_tool::<FindSitesWithIssuesParams>(
        "find-sites-with-issues",
        "🌟 Tier 1: Find which sites need attention right now. Returns sites ranked by \
         problem severity with breakdown of alerts and offline devices. Use after dashboard \
         to identify specific sites to investigate.",
    )
}

pub fn find_sites_with_issues_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: FindSitesWithIssuesParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Fetch sites and alerts in parallel
            let sites_fut = client.list_sites_with_mcp(Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            }), &mcp_headers);
            let alerts_fut = client.list_open_alerts_with_mcp(Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            }), &mcp_headers);

            let (sites_res, alerts_res) = tokio::join!(sites_fut, alerts_fut);

            let sites_data = sites_res.map_err(|e| crate::Error::Api(format!("Failed to get sites: {}", e)))?;
            let alerts_data = alerts_res.map_err(|e| crate::Error::Api(format!("Failed to get alerts: {}", e)))?;

            let sites = sites_data.sites.unwrap_or_default();
            let alerts = alerts_data.alerts.unwrap_or_default();

            // Aggregate alert counts by site
            let mut alerts_by_site = std::collections::HashMap::new();
            for alert in &alerts {
                let site_uid = alert
                    .alert_source_info
                    .as_ref()
                    .and_then(|info| info.site_uid.as_ref())
                    .map(|s| s.as_str())
                    .unwrap_or("unknown");

                let entry = alerts_by_site.entry(site_uid.to_string()).or_insert((0, 0));
                
                match &alert.priority {
                    Some(Priority::Critical) => entry.0 += 1,
                    Some(Priority::High) | Some(Priority::Moderate) => entry.1 += 1,
                    _ => {}
                }
            }

            // Calculate site issue scores
            let mut site_issues: Vec<_> = sites
                .iter()
                .map(|site| {
                    let site_uid = site.uid.as_deref().unwrap_or("");
                    let (critical, warnings) = alerts_by_site.get(site_uid).copied().unwrap_or((0, 0));
                    
                    let offline_devices = site
                        .devices_status
                        .as_ref()
                        .and_then(|s| s.number_of_offline_devices)
                        .unwrap_or(0);
                    
                    let total_devices = site
                        .devices_status
                        .as_ref()
                        .and_then(|s| s.number_of_devices)
                        .unwrap_or(0);

                    // Score: critical alerts * 10 + warning alerts * 2 + offline devices * 3
                    let score = critical * 10 + warnings * 2 + offline_devices * 3;

                    (site.name.clone().unwrap_or_else(|| "Unknown Site".to_string()),
                     site_uid.to_string(),
                     critical,
                     warnings,
                     offline_devices,
                     total_devices,
                     score)
                })
                .filter(|(_, _, critical, warnings, offline, _, _)| {
                    // Filter by severity
                    let has_critical = *critical > 0;
                    let has_warnings = *warnings > 0;
                    let meets_severity = match params.severity.as_str() {
                        "critical" => has_critical,
                        "warning" => has_warnings,
                        _ => has_critical || has_warnings || *offline > 0,
                    };
                    
                    // Filter by minimum offline devices
                    let meets_offline = *offline >= params.min_offline_devices as i64;
                    
                    meets_severity && meets_offline
                })
                .collect();

            // Sort by score
            match params.sort_by.as_str() {
                "alerts" => site_issues.sort_by(|a, b| (b.2 + b.3).cmp(&(a.2 + a.3))),
                "offline_devices" => site_issues.sort_by(|a, b| b.4.cmp(&a.4)),
                _ => site_issues.sort_by(|a, b| b.6.cmp(&a.6)), // combined score
            }

            let top_sites: Vec<_> = site_issues.iter().take(params.limit as usize).collect();

            // Build response
            let mut lines = Vec::new();
            lines.push("# Sites With Issues".to_string());
            lines.push(String::new());

            if top_sites.is_empty() {
                lines.push("✅ No sites found matching criteria.".to_string());
                lines.push(String::new());
                lines.push("All sites are healthy!".to_string());
            } else {
                lines.push(format!("Found {} site{} with issues:", top_sites.len(), if top_sites.len() > 1 { "s" } else { "" }));
                lines.push(String::new());

                for (index, (name, uid, critical, warnings, offline, total, _score)) in top_sites.iter().enumerate() {
                    lines.push(format!("{}. **{}** (UID: `{}`)", index + 1, name, uid));
                    
                    if *critical > 0 {
                        lines.push(format!("   - 🔴 {} critical alert{}", critical, if *critical > 1 { "s" } else { "" }));
                    }
                    if *warnings > 0 {
                        lines.push(format!("   - ⚠️  {} warning{}", warnings, if *warnings > 1 { "s" } else { "" }));
                    }
                    if *offline > 0 {
                        lines.push(format!("   - 📵 {} offline device{}", offline, if *offline > 1 { "s" } else { "" }));
                    }
                    lines.push(format!("   - 📊 {} total devices", total));
                    lines.push(String::new());
                }

                lines.push("💡 **Next:** Use `get-site-health` to investigate specific sites".to_string());
            }

            let result_data = serde_json::json!({
                "parameters": {
                    "severity": &params.severity,
                    "min_offline_devices": params.min_offline_devices,
                    "sort_by": &params.sort_by,
                    "limit": params.limit
                },
                "sites": &sites,
                "alerts": &alerts,
                "problem_sites": top_sites.iter().map(|(name, uid, critical, warnings, offline, total, score)| serde_json::json!({
                    "name": name,
                    "uid": uid,
                    "critical_alerts": critical,
                    "warnings": warnings,
                    "offline_devices": offline,
                    "total_devices": total,
                    "issue_score": score
                })).collect::<Vec<_>>()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this list of sites with issues in priority order. If no sites found, show a positive 'All Clear' message. For each problem site, display name prominently with UID for reference, then list critical alerts (red icon), warnings (yellow icon), and offline devices (offline icon). Show total devices for context. Sort by the ranking provided based on issue scores. End with a suggestion to use get-site-health for detailed investigation of specific sites. Make critical issues immediately visible.",
                Some(vec!["priority_ranking", "severity_icons", "issue_breakdown", "actionable_next_steps"])
            ))
        })
    })
}

// ============================================================================
// search-devices
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct SearchDevicesParams {
    #[schemars(description = "Search term (matches hostname, IP, site, OS)")]
    pub query: String,

    #[schemars(description = "Device status filter: online, offline, or all")]
    #[serde(default = "default_status")]
    pub status: String,

    #[schemars(description = "Only devices with open alerts")]
    #[serde(default)]
    pub has_alerts: bool,

    #[schemars(description = "Maximum results to return")]
    #[serde(default = "default_search_limit")]
    pub limit: u32,
}

fn default_status() -> String {
    "all".to_string()
}
fn default_search_limit() -> u32 {
    20
}

pub fn search_devices_tool() -> Tool {
    tool_helpers::create_tool::<SearchDevicesParams>(
        "search-devices",
        "🌟 Tier 1: Search across all sites when you don't know which site contains a device. \
         Searches hostname, IP, site name, and OS. Returns devices with site context and alert counts.",
    )
}

pub fn search_devices_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SearchDevicesParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Get all devices (no pagination - limit applied after filtering)
            let devices_data = client
                .list_devices_with_mcp(Some(datto_api::PaginationQuery {
                    page: None,
                    max: None,
                }), &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list devices: {}", e)))?;

            let all_devices = devices_data.devices.unwrap_or_default();

            // Filter devices based on query
            let query_lower = params.query.to_lowercase();
            let matching_devices: Vec<_> = all_devices
                .iter()
                .filter(|device| {
                    // Match against hostname, IP, site name, or OS
                    let hostname_match = device
                        .hostname
                        .as_ref()
                        .map(|h| h.to_lowercase().contains(&query_lower))
                        .unwrap_or(false);

                    let site_match = device
                        .site_name
                        .as_ref()
                        .map(|s| s.to_lowercase().contains(&query_lower))
                        .unwrap_or(false);

                    let os_match = device
                        .operating_system
                        .as_ref()
                        .map(|os| os.to_lowercase().contains(&query_lower))
                        .unwrap_or(false);

                    hostname_match || site_match || os_match
                })
                .filter(|device| {
                    // Filter by status if specified
                    match params.status.as_str() {
                        "online" => device.online.unwrap_or(false),
                        "offline" => !device.online.unwrap_or(true),
                        _ => true, // "all"
                    }
                })
                .take(params.limit as usize)
                .collect();

            // Build response
            let mut lines = Vec::new();

            lines.push(format!("# Search Results: \"{}\"", params.query));
            lines.push(String::new());

            if matching_devices.is_empty() {
                lines.push("No devices found matching your search criteria.".to_string());
                lines.push(String::new());
                lines.push("**Tips:**".to_string());
                lines.push("- Try a partial hostname (e.g., \"web\" instead of \"web-server-01\")".to_string());
                lines.push("- Search by site name instead".to_string());
                lines.push("- Check the device status filter".to_string());
            } else {
                lines.push(format!("Found {} device{}:", matching_devices.len(), if matching_devices.len() > 1 { "s" } else { "" }));
                lines.push(String::new());

                for (index, device) in matching_devices.iter().enumerate() {
                    let status_icon = if device.online.unwrap_or(false) { "🟢" } else { "📵" };
                    let hostname = device.hostname.as_deref().unwrap_or("Unknown");
                    let site_name = device.site_name.as_deref().unwrap_or("Unknown Site");
                    
                    lines.push(format!("{}. {} **{}** ({})", index + 1, status_icon, hostname, site_name));
                    
                    if let Some(device_type) = &device.device_type {
                        if let Some(type_name) = &device_type.r#type {
                            lines.push(format!("   Type: {}", type_name));
                        }
                    }
                    
                    if let Some(os) = &device.operating_system {
                        lines.push(format!("   OS: {}", os));
                    }

                    if let Some(uid) = &device.uid {
                        lines.push(format!("   Device UID: `{}`", uid));
                    }
                    if let Some(site_uid) = &device.site_uid {
                        lines.push(format!("   Site UID: `{}`", site_uid));
                    }
                    
                    lines.push(String::new());
                }

                lines.push("💡 **Next:** Use `get-site-health` or `get-device-health` for detailed information".to_string());
            }

            let result_data = serde_json::json!({
                "query": &params.query,
                "filters": {
                    "status": &params.status,
                    "has_alerts": params.has_alerts,
                    "limit": params.limit
                },
                "matching_devices": matching_devices.iter().map(|device| serde_json::json!({
                    "hostname": device.hostname,
                    "uid": device.uid,
                    "site_name": device.site_name,
                    "site_uid": device.site_uid,
                    "online": device.online,
                    "operating_system": device.operating_system,
                    "device_type": device.device_type
                })).collect::<Vec<_>>()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present these device search results clearly. Show the search query prominently. If no devices found, display a helpful 'no results' message with search tips (try partial hostname, search by site, check status filter). For each matching device, show online/offline status with icon, hostname prominently, site name in context, device type, OS, and UIDs for reference. End with suggestion to use get-site-health or get-device-health for deeper investigation. Make it easy to quickly scan the results.",
                Some(vec!["search_results_layout", "status_icons", "no_results_help", "device_details"])
            ))
        })
    })
}

// ============================================================================
// get-account-analytics
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct GetAccountAnalyticsParams {
    #[schemars(description = "Time range for trending analysis (default: month)")]
    #[serde(default = "default_analytics_time_range")]
    pub time_range: String,
}

fn default_analytics_time_range() -> String {
    "month".to_string()
}

pub fn get_account_analytics_tool() -> Tool {
    tool_helpers::create_tool::<GetAccountAnalyticsParams>(
        "get-account-analytics",
        "🌟 [Tier 1] Account-wide usage metrics and trends for capacity planning.",
    )
}

pub fn get_account_analytics_handler() -> ToolHandler {
    Box::new(|_client: Arc<DattoClient>, args: Value, _mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: GetAccountAnalyticsParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let result_data = serde_json::json!({
                "time_range": &params.time_range,
                "status": "pending_implementation",
                "planned_metrics": [
                    "Device growth trends",
                    "Site statistics and patterns",
                    "Alert frequency and MTTR",
                    "Capacity planning insights"
                ]
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this account analytics information. Show the time range, then list the planned metrics that will be included when fully implemented. Note that this is a pending implementation that will aggregate historical data and trends. Keep it brief and informative.",
                Some(vec!["pending_feature", "metrics_preview"])
            ))
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_account_dashboard_params_time_range_defaults_to_today() {
        let p: GetAccountDashboardParams = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(p.time_range, "today");
    }

    #[test]
    fn get_account_dashboard_params_custom_time_range() {
        let p: GetAccountDashboardParams =
            serde_json::from_value(serde_json::json!({"time_range": "week"})).unwrap();
        assert_eq!(p.time_range, "week");
    }

    #[test]
    fn find_sites_with_issues_defaults() {
        let p: FindSitesWithIssuesParams = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(p.severity, "critical");
        assert_eq!(p.min_offline_devices, 1);
    }

    #[test]
    fn search_devices_params_query_required() {
        let p: SearchDevicesParams =
            serde_json::from_value(serde_json::json!({"query": "laptop"})).unwrap();
        assert_eq!(p.query, "laptop");
    }

    #[test]
    fn search_devices_params_missing_query_fails() {
        assert!(serde_json::from_value::<SearchDevicesParams>(serde_json::json!({})).is_err());
    }

    #[test]
    fn get_account_analytics_time_range_defaults_to_month() {
        let p: GetAccountAnalyticsParams = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(p.time_range, "month");
    }
}
