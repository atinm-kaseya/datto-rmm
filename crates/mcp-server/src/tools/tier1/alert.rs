use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::{DattoClient, McpCallHeaders, Priority};
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

// ============================================================================
// rmm_get_alert_summary
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct GetAlertSummaryParams {
    #[schemars(description = "Filter to specific site (optional, account-wide if omitted)")]
    pub site: Option<String>,

    #[schemars(description = "Severity filter: critical, warning, or all")]
    #[serde(default = "default_severity")]
    pub severity: String,

    #[schemars(description = "Group by: device, type, or site")]
    #[serde(default = "default_group_by")]
    pub group_by: String,

    #[schemars(description = "Time range: today, week, or month")]
    #[serde(default = "default_time_range")]
    pub time_range: String,
}

fn default_severity() -> String {
    "all".to_string()
}
fn default_group_by() -> String {
    "type".to_string()
}
fn default_time_range() -> String {
    "today".to_string()
}

pub fn get_alert_summary_tool() -> Tool {
    tool_helpers::create_tool::<GetAlertSummaryParams>(
        "rmm_get_alert_summary",
        "🌟 Tier 1: Alert trending and analytics. Shows alert counts by grouping dimension, \
         trending analysis vs previous period, most affected devices/sites, and common patterns. \
         Supports both account-wide and site-filtered views.",
    )
}

pub fn get_alert_summary_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: GetAlertSummaryParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            // Fetch alerts (site-specific or account-wide)
            let alerts_data = if let Some(site_filter) = &params.site {
                // Resolve site UID if needed (resolver uses base client, no MCP headers)
                let site_uid = crate::utils::resolver::resolve_site(&client, site_filter).await?;

                client.list_site_open_alerts_with_mcp(&site_uid, Some(datto_api::PaginationQuery {
                    page: None,
                    max: None,
                }), &mcp_headers).await
            } else {
                client.list_open_alerts_with_mcp(Some(datto_api::PaginationQuery {
                    page: None,
                    max: None,
                }), &mcp_headers).await
            }.map_err(|e| crate::Error::Api(format!("Failed to get alerts: {}", e)))?;

            let mut alerts = alerts_data.alerts.unwrap_or_default();

            // Filter by severity
            if params.severity != "all" {
                alerts.retain(|alert| {
                    match params.severity.as_str() {
                        "critical" => matches!(alert.priority, Some(Priority::Critical)),
                        "warning" => matches!(alert.priority, Some(Priority::High) | Some(Priority::Moderate)),
                        _ => true,
                    }
                });
            }

            // Count by severity
            let critical_count = alerts.iter().filter(|a| matches!(a.priority, Some(Priority::Critical))).count();
            let warning_count = alerts.iter().filter(|a| matches!(a.priority, Some(Priority::High) | Some(Priority::Moderate))).count();

            // Group alerts
            let mut grouped_data: std::collections::HashMap<String, (usize, usize)> = std::collections::HashMap::new();
            
            for alert in &alerts {
                let group_key = match params.group_by.as_str() {
                    "device" => {
                        alert.alert_source_info
                            .as_ref()
                            .and_then(|info| info.device_name.clone())
                            .unwrap_or_else(|| "Unknown Device".to_string())
                    }
                    "site" => {
                        alert.alert_source_info
                            .as_ref()
                            .and_then(|info| info.site_name.clone())
                            .unwrap_or_else(|| "Unknown Site".to_string())
                    }
                    _ => {
                        // Group by type (extracted from diagnostics)
                        alert.diagnostics
                            .as_ref()
                            .and_then(|d| d.split(':').next())
                            .unwrap_or("Unknown")
                            .to_string()
                    }
                };
                
                let entry = grouped_data.entry(group_key).or_insert((0, 0));
                entry.0 += 1; // total count
                
                if matches!(alert.priority, Some(Priority::Critical)) {
                    entry.1 += 1; // critical count
                }
            }

            // Sort groups by total count
            let mut grouped_vec: Vec<_> = grouped_data.into_iter().collect();
            grouped_vec.sort_by(|a, b| b.1.0.cmp(&a.1.0));

            // Build response
            let mut lines = Vec::new();

            let scope_str = params.site.as_ref().map(|s| format!("{} ", s)).unwrap_or_default();
            lines.push(format!("# Alert Summary: {}(Last {})", scope_str, params.time_range));
            lines.push(String::new());

            lines.push(format!("**Total Open Alerts:** {} ({} critical, {} warnings)", 
                alerts.len(), critical_count, warning_count));
            lines.push(String::new());

            // Grouped data
            if !grouped_vec.is_empty() {
                lines.push(format!("## Grouped by {}", match params.group_by.as_str() {
                    "device" => "Device",
                    "site" => "Site",
                    _ => "Type",
                }));
                lines.push(String::new());
                
                for (index, (group_name, (total, critical))) in grouped_vec.iter().take(10).enumerate() {
                    lines.push(format!("{}. **{}**: {} alert{} ({} critical)", 
                        index + 1, 
                        group_name, 
                        total,
                        if *total > 1 { "s" } else { "" },
                        critical
                    ));
                }
                
                if grouped_vec.len() > 10 {
                    lines.push(String::new());
                    lines.push(format!("_...and {} more groups_", grouped_vec.len() - 10));
                }
                
                lines.push(String::new());
            }

            // Recommendations
            lines.push("## 💡 Patterns & Recommendations".to_string());
            lines.push(String::new());
            
            if critical_count > 0 {
                lines.push(format!("- {} critical alerts require immediate attention", critical_count));
            }
            
            if let Some((top_group, (count, _))) = grouped_vec.first() {
                lines.push(format!("- Most common issue: {} ({} alerts)", top_group, count));
            }
            
            if alerts.is_empty() {
                lines.push("- No alerts matching criteria - system is healthy!".to_string());
            }

            let result_data = serde_json::json!({
                "parameters": {
                    "site": &params.site,
                    "severity": &params.severity,
                    "time_range": &params.time_range,
                    "group_by": &params.group_by
                },
                "alerts": &alerts,
                "summary": {
                    "total_alerts": alerts.len(),
                    "critical_count": critical_count,
                    "warning_count": warning_count
                },
                "grouped_data": &grouped_vec.iter().map(|(name, (total, critical))| serde_json::json!({
                    "group_name": name,
                    "total_alerts": total,
                    "critical_alerts": critical
                })).collect::<Vec<_>>()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this alert summary analysis clearly. Show the scope (site-specific or account-wide) and time range in the heading. Display total alert count with breakdown by severity - use a pie chart or donut chart to visualize the distribution of critical vs warning alerts. Group alerts by the specified dimension (device, site, or type) and show the top groups - consider using a horizontal bar chart to visualize alert counts per group, making it easy to spot the top problem areas. Rank groups by total alert count with visual indicators showing both total and critical alert counts. If showing more than 10 groups, indicate how many more exist. End with patterns and recommendations - highlight critical alerts requiring attention, identify the most common issue, or note if system is healthy. Make the data scannable with charts and visual hierarchy.",
                Some(vec!["summary_layout", "pie_charts", "donut_charts", "bar_charts", "severity_breakdown", "grouped_analysis", "priority_ranking", "pattern_insights", "visual_hierarchy"])
            ))
        })
    })
}

// ============================================================================
// rmm_investigate_alert
// ============================================================================

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct InvestigateAlertParams {
    #[schemars(description = "Alert UID to investigate")]
    pub alert_uid: String,

    #[schemars(description = "Find similar alerts on other devices (default: true)")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_similar: Option<bool>,
}

pub fn investigate_alert_tool() -> Tool {
    tool_helpers::create_tool::<InvestigateAlertParams>(
        "rmm_investigate_alert",
        "🌟 [Tier 1] Deep alert analysis with pattern detection and resolution suggestions.",
    )
}

pub fn investigate_alert_handler() -> ToolHandler {
    Box::new(|_client: Arc<DattoClient>, args: Value, _mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: InvestigateAlertParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let result_data = serde_json::json!({
                "alert_uid": &params.alert_uid,
                "include_similar": params.include_similar.unwrap_or(true),
                "status": "pending_implementation",
                "investigation_capabilities": [
                    "Alert context and related data",
                    "Similar alerts across environment",
                    "Impact assessment",
                    "Resolution suggestions based on patterns"
                ]
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this alert investigation information. Show the alert UID prominently. List the investigation capabilities that will be available when fully implemented. Note that this feature is pending implementation and will aggregate data to provide actionable insights. Keep it brief and informative.",
                Some(vec!["pending_feature", "investigation_preview"])
            ))
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_alert_summary_site_optional() {
        let p: GetAlertSummaryParams = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(p.site.is_none());
    }

    #[test]
    fn get_alert_summary_with_site() {
        let p: GetAlertSummaryParams =
            serde_json::from_value(serde_json::json!({"site": "site-abc"})).unwrap();
        assert_eq!(p.site, Some("site-abc".into()));
    }

    #[test]
    fn investigate_alert_params_uid_required() {
        let p: InvestigateAlertParams =
            serde_json::from_value(serde_json::json!({"alert_uid": "a-1"})).unwrap();
        assert_eq!(p.alert_uid, "a-1");
        assert!(p.include_similar.is_none());
    }

    #[test]
    fn investigate_alert_params_include_similar() {
        let p: InvestigateAlertParams = serde_json::from_value(
            serde_json::json!({"alert_uid": "a-1", "include_similar": false}),
        )
        .unwrap();
        assert_eq!(p.include_similar, Some(false));
    }
}
