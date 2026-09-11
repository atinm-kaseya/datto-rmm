use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::{DattoClient, McpCallHeaders, Priority};
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

// ============================================================================
// rmm_get_device_health
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct GetDeviceHealthParams {
    #[schemars(description = "Device hostname, UID, or MAC address")]
    pub device: String,

    #[schemars(description = "Site name or UID (optional, helps resolve hostname faster)")]
    pub site: Option<String>,

    #[schemars(description = "Include recent job/alert history")]
    #[serde(default = "default_include_history")]
    pub include_history: bool,
}

fn default_include_history() -> bool {
    true
}

pub fn get_device_health_tool() -> Tool {
    tool_helpers::create_tool::<GetDeviceHealthParams>(
        "rmm_get_device_health",
        "🌟 Tier 1: Complete device health snapshot with site context. Shows device overview, \
         system info, hardware details, open alerts, and AI-friendly recommendations. \
         Optionally includes recent job/alert history.",
    )
}

pub fn get_device_health_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: GetDeviceHealthParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Resolve device name/MAC/UID to UID using the resolver (no MCP headers for resolution)
            let site_uid = if let Some(site) = &params.site {
                Some(crate::utils::resolver::resolve_site(&client, site).await?)
            } else {
                None
            };

            let device_uid = crate::utils::resolver::resolve_device(
                &client,
                &params.device,
                site_uid.as_deref()
            ).await?;

            // Fetch device data in parallel
            let device_fut = client.get_device_with_mcp(&device_uid, &mcp_headers);
            let alerts_fut = client.list_device_open_alerts_with_mcp(&device_uid, Some(datto_api::PaginationQuery {
                page: None,
                max: None,
            }), &mcp_headers);
            let audit_fut = client.get_device_audit_with_mcp(&device_uid, &mcp_headers);

            let (device_res, alerts_res, audit_res) = tokio::join!(device_fut, alerts_fut, audit_fut);

            let device = device_res.map_err(|e| crate::Error::Api(format!("Failed to get device: {}", e)))?;
            let alerts_data = alerts_res.map_err(|e| crate::Error::Api(format!("Failed to get alerts: {}", e)))?;
            let audit = audit_res.ok(); // Audit optional

            let alerts = alerts_data.alerts.unwrap_or_default();

            // Build response
            let mut lines = Vec::new();

            lines.push(format!("# Device Health: {}", device.hostname.as_deref().unwrap_or("Unknown Device")));
            lines.push(String::new());
            lines.push(format!("**Site:** {}", device.site_name.as_deref().unwrap_or("Unknown")));
            lines.push(format!("**Device UID:** `{}`", device_uid));
            
            let status = if device.online.unwrap_or(false) {
                "🟢 Online"
            } else {
                "📵 Offline"
            };
            lines.push(format!("**Status:** {}", status));
            
            if let Some(device_type) = &device.device_type {
                if let Some(dt) = &device_type.r#type {
                    lines.push(format!("**Type:** {}", dt));
                }
            }
            
            if let Some(os) = &device.operating_system {
                lines.push(format!("**OS:** {}", os));
            }
            
            lines.push(String::new());

            // Hardware details from audit
            if let Some(ref audit) = audit {
                lines.push("## 💻 Hardware".to_string());
                lines.push(String::new());
                
                if let Some(processors) = &audit.processors {
                    if let Some(processor) = processors.first() {
                        if let Some(name) = &processor.name {
                            lines.push(format!("**CPU:** {}", name));
                        }
                    }
                }
                
                if let Some(memory_modules) = &audit.physical_memory {
                    let total_memory: i64 = memory_modules.iter()
                        .filter_map(|m| m.size)
                        .sum();
                    if total_memory > 0 {
                        let memory_gb = total_memory / (1024 * 1024 * 1024);
                        lines.push(format!("**RAM:** {} GB ({} module{})", 
                            memory_gb, 
                            memory_modules.len(),
                            if memory_modules.len() > 1 { "s" } else { "" }));
                    }
                }
                
                if let Some(disks) = &audit.logical_disks {
                    lines.push(String::new());
                    lines.push("**Disks:**".to_string());
                    for disk in disks.iter().take(5) {
                        if let (Some(desc), Some(size), Some(free)) = (&disk.description, disk.size, disk.freespace) {
                            let size_gb = size / (1024 * 1024 * 1024);
                            let free_gb = free / (1024 * 1024 * 1024);
                            let percent_free = if size > 0 { (free * 100) / size } else { 0 };
                            let warning = if percent_free < 10 { " ⚠️  LOW" } else { "" };
                            lines.push(format!("- {}: {} GB ({} GB free, {}%{})", desc, size_gb, free_gb, percent_free, warning));
                        }
                    }
                }
                
                lines.push(String::new());
            }

            // Alert summary
            if !alerts.is_empty() {
                let critical_count = alerts.iter().filter(|a| matches!(a.priority, Some(Priority::Critical))).count();
                let warning_count = alerts.iter().filter(|a| matches!(a.priority, Some(Priority::High) | Some(Priority::Moderate))).count();
                
                lines.push(format!("## ⚠️  Open Alerts ({})", alerts.len()));
                lines.push(String::new());
                lines.push(format!("**Breakdown:** {} critical, {} warnings", critical_count, warning_count));
                lines.push(String::new());
                
                for (index, alert) in alerts.iter().take(10).enumerate() {
                    let priority_str = match &alert.priority {
                        Some(Priority::Critical) => "🔴 CRITICAL",
                        Some(Priority::High) => "🟠 HIGH",
                        Some(Priority::Moderate) => "⚠️  MODERATE",
                        _ => "ℹ️  INFO",
                    };
                    let diagnostics = alert.diagnostics.as_deref().unwrap_or("No details");
                    lines.push(format!("{}. [{}] {}", index + 1, priority_str, diagnostics));
                }
                
                if alerts.len() > 10 {
                    lines.push(format!("\n_...and {} more alerts_", alerts.len() - 10));
                }
                
                lines.push(String::new());
            } else {
                lines.push("## ✅ No Open Alerts".to_string());
                lines.push(String::new());
            }

            // Recommendations
            lines.push("## 💡 Recommended Actions".to_string());
            lines.push(String::new());
            
            if !device.online.unwrap_or(false) {
                lines.push("1. **Device is offline** - Check connectivity".to_string());
            } else if !alerts.is_empty() {
                let critical_alerts: Vec<_> = alerts.iter()
                    .filter(|a| matches!(a.priority, Some(Priority::Critical)))
                    .collect();
                
                if !critical_alerts.is_empty() {
                    lines.push(format!("1. **Address {} critical alert{}", critical_alerts.len(), if critical_alerts.len() > 1 { "s" } else { "" }));
                    
                    // Suggest actions based on alert types
                    let has_disk_space = critical_alerts.iter().any(|a| 
                        a.diagnostics.as_ref().map(|d| d.to_lowercase().contains("disk")).unwrap_or(false)
                    );
                    if has_disk_space {
                        lines.push("   - Run disk cleanup".to_string());
                    }
                }
            } else {
                lines.push("- Device is healthy - no immediate actions needed".to_string());
            }

            let result_data = serde_json::json!({
                "device_uid": &device_uid,
                "device": serde_json::to_value(&device).unwrap(),
                "alerts": serde_json::to_value(&alerts).unwrap(),
                "audit": serde_json::to_value(&audit).unwrap(),
                "analysis": {
                    "critical_alerts_count": alerts.iter().filter(|a| matches!(a.priority, Some(Priority::Critical))).count(),
                    "warning_alerts_count": alerts.iter().filter(|a| matches!(a.priority, Some(Priority::High) | Some(Priority::Moderate))).count(),
                    "total_alerts": alerts.len(),
                    "is_online": device.online.unwrap_or(false)
                }
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this device health report comprehensively. Start with device name as heading, show site name and status prominently (online with green icon, offline with red). Display device type and OS. If hardware audit data is available, show CPU, RAM, and disk information - use progress bars to visualize disk usage percentage (color-coded: green for healthy, yellow for warning, red for critical under 10%). For memory usage, also consider progress bars. Display alert summary with severity breakdown - use pie chart or donut chart showing distribution of critical vs warning alerts. List open alerts grouped by severity (critical in red, warnings in yellow). For each alert show priority and diagnostic message. If more than 10 alerts, show the most critical and note how many more exist. End with recommended actions - if offline suggest connectivity check, if critical alerts suggest addressing them with specific actions based on alert type (e.g., disk cleanup for disk space alerts), otherwise indicate device is healthy. Make this dashboard visually rich with charts and progress indicators.",
                Some(vec!["comprehensive_overview", "status_prominent", "hardware_details", "progress_bars", "health_visualizations", "pie_charts", "donut_charts", "alert_priority_grouping", "actionable_recommendations", "low_disk_warnings", "visual_hierarchy"])
            ))
        })
    })
}

// ============================================================================
// rmm_diagnose_device_issue 
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct DiagnoseDeviceIssueParams {
    #[schemars(description = "Device identifier: hostname, UID, or MAC address")]
    pub device: String,

    #[schemars(description = "Site name or UID (optional, helps resolve device)")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site: Option<String>,

    #[schemars(description = "Brief description of problem (e.g., slow performance, backup failing)")]
    pub issue: String,
}

pub fn diagnose_device_issue_tool() -> Tool {
    tool_helpers::create_tool::<DiagnoseDeviceIssueParams>(
        "rmm_diagnose_device_issue",
        "🌟 [Tier 1] AI-assisted device troubleshooting. Analyzes device state and provides actionable diagnosis.",
    )
}

pub fn diagnose_device_issue_handler() -> ToolHandler {
    Box::new(|_client: Arc<DattoClient>, args: Value, _mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: DiagnoseDeviceIssueParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let result_data = serde_json::json!({
                "device": &params.device,
                "site": &params.site,
                "issue": &params.issue,
                "status": "pending_implementation",
                "analysis_capabilities": [
                    "Current device state and alerts",
                    "Recent audit data and changes",
                    "Performance metrics and trends",
                    "Similar issues across environment"
                ]
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this device diagnostic information. Show the device name and reported issue prominently. List the analysis capabilities that will be available when fully implemented. Note that this diagnostic feature is pending implementation and will combine data from multiple sources for AI-assisted analysis. Keep it brief and informative.",
                Some(vec!["pending_feature", "diagnostic_preview"])
            ))
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_device_health_device_required() {
        let p: GetDeviceHealthParams =
            serde_json::from_value(serde_json::json!({"device": "my-laptop"})).unwrap();
        assert_eq!(p.device, "my-laptop");
        assert!(p.site.is_none());
    }

    #[test]
    fn get_device_health_missing_device_fails() {
        assert!(serde_json::from_value::<GetDeviceHealthParams>(serde_json::json!({})).is_err());
    }

    #[test]
    fn diagnose_device_issue_device_and_issue_required() {
        let p: DiagnoseDeviceIssueParams = serde_json::from_value(serde_json::json!({
            "device": "server-01",
            "issue": "backup failing"
        }))
        .unwrap();
        assert_eq!(p.device, "server-01");
        assert_eq!(p.issue, "backup failing");
        assert!(p.site.is_none());
    }

    #[test]
    fn diagnose_device_issue_missing_issue_fails() {
        assert!(
            serde_json::from_value::<DiagnoseDeviceIssueParams>(
                serde_json::json!({"device": "server-01"})
            )
            .is_err()
        );
    }
}
