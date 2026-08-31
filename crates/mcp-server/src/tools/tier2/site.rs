//! Tier 2: Site-level API tools

use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::{DattoClient, McpCallHeaders};
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct SiteUidParams {
    pub site_uid: String,
}

pub fn get_site_tool() -> Tool {
    tool_helpers::create_tool::<SiteUidParams>(
        "rmm_get_site",
        "🔧 [Advanced] Get site info. Returns formatted markdown with site details.",
    )
}

pub fn get_site_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SiteUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let site = client
                .get_site_with_mcp(&params.site_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get site: {}", e)))?;

            let mut summary = format!("# {}\n\n", site.name.as_deref().unwrap_or("Unknown Site"));
            summary.push_str(&format!("**UID:** `{}`\n\n", site.uid.as_deref().unwrap_or("N/A")));

            let device_status = site.devices_status.as_ref().map(|status| {
                let total = status.number_of_devices.unwrap_or(0);
                let online = status.number_of_online_devices.unwrap_or(0);
                let offline = status.number_of_offline_devices.unwrap_or(0);
                let percentage = if total > 0 {
                    (online as f64 / total as f64 * 100.0) as i32
                } else {
                    0
                };
                serde_json::json!({
                    "total": total,
                    "online": online,
                    "offline": offline,
                    "online_percentage": percentage
                })
            });

            let result_data = serde_json::json!({
                "site": serde_json::to_value(&site).unwrap(),
                "device_status": device_status
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this site information. Show site name prominently with UID for reference. If device status is available, display device counts with status icons (green for online, red for offline) and show the online percentage. Make the data easy to scan.",
                Some(vec!["site_overview", "device_counts", "status_icons"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct SiteListParams {
    pub site_uid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<i32>,
}

pub fn list_site_devices_tool() -> Tool {
    tool_helpers::create_tool::<SiteListParams>(
        "rmm_get_site_devices",
        "🔧 [Advanced] List site's devices. Returns formatted markdown with device list.",
    )
}

pub fn list_site_devices_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SiteListParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let devices_data = client
                .list_site_devices_with_mcp(
                    &params.site_uid,
                    Some(datto_api::PaginationQuery {
                        page: params.page,
                        max: params.max,
                    }),
                    &mcp_headers,
                )
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list site devices: {}", e)))?;

            let devices = devices_data.devices.as_ref().map(|d| d.as_slice()).unwrap_or(&[]);

            if devices.is_empty() {
                let result_data = serde_json::json!({
                    "site_uid": &params.site_uid,
                    "devices": [],
                    "pagination": devices_data.page_details
                });
                return Ok(tool_helpers::instructed_result(
                    result_data,
                    "No devices found in this site. Note this clearly.",
                    Some(vec!["no_results"])
                ));
            }

            let online_count = devices.iter().filter(|d| d.online.unwrap_or(false)).count();
            let offline_count = devices.len() - online_count;

            let result_data = serde_json::json!({
                "site_uid": &params.site_uid,
                "devices": serde_json::to_value(devices).unwrap(),
                "pagination": devices_data.page_details,
                "summary": {
                    "total": devices.len(),
                    "online": online_count,
                    "offline": offline_count
                }
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this site device list. Show total device count with online/offline breakdown using status icons (green for online, red for offline). Group devices by online status, listing online devices first, then offline. For each device show hostname, device type, and UID. Make offline devices easily visible.",
                Some(vec!["device_list", "status_grouping", "status_icons", "count_summary"])
            ))
        })
    })
}

pub fn list_site_open_alerts_tool() -> Tool {
    tool_helpers::create_tool::<SiteListParams>(
        "rmm_list_site_open_alerts",
        "🔧 [Advanced] List site alerts. Returns formatted markdown with alert details.",
    )
}

pub fn list_site_open_alerts_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SiteListParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let alerts_data = client
                .list_site_open_alerts_with_mcp(
                    &params.site_uid,
                    Some(datto_api::PaginationQuery {
                        page: params.page,
                        max: params.max,
                    }),
                    &mcp_headers,
                )
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list site alerts: {}", e)))?;

            let alerts = alerts_data.alerts.as_ref().map(|a| a.as_slice()).unwrap_or(&[]);

            if alerts.is_empty() {
                let result_data = serde_json::json!({
                    "site_uid": &params.site_uid,
                    "alerts": [],
                    "pagination": alerts_data.page_details
                });
                return Ok(tool_helpers::instructed_result(
                    result_data,
                    "No open alerts for this site. Present this as a positive message.",
                    Some(vec!["no_alerts", "positive_indicator"])
                ));
            }

            let critical_count = alerts.iter().filter(|a| matches!(a.priority, Some(datto_api::Priority::Critical) | Some(datto_api::Priority::High))).count();
            let medium_count = alerts.iter().filter(|a| matches!(a.priority, Some(datto_api::Priority::Moderate))).count();
            let low_count = alerts.len() - critical_count - medium_count;

            let result_data = serde_json::json!({
                "site_uid": &params.site_uid,
                "alerts": serde_json::to_value(alerts).unwrap(),
                "pagination": alerts_data.page_details,
                "summary": {
                    "total": alerts.len(),
                    "critical_high": critical_count,
                    "medium": medium_count,
                    "low": low_count
                }
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present these open alerts for the site. Show total count and severity breakdown. Group alerts by priority (critical/high first in red, then medium in yellow, then low in green). For each alert show device name, diagnostic message, and alert UID. Make critical alerts immediately visible.",
                Some(vec!["alert_list", "severity_grouping", "severity_icons", "priority_order"])
            ))
        })
    })
}

pub fn get_site_settings_tool() -> Tool {
    tool_helpers::create_tool::<SiteUidParams>(
        "rmm_get_site_settings",
        "🔧 [Advanced] Get site settings. Returns formatted markdown with configuration details.",
    )
}

pub fn get_site_settings_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SiteUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let settings = client
                .get_site_settings_with_mcp(&params.site_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get site settings: {}", e)))?;

            let data = serde_json::to_value(&settings)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Analyze these site settings and present them in a well-organized format. Show general settings (name, UID, on-demand status) prominently. If proxy settings are configured, display them clearly. List email recipients if any are configured. Use checkmarks or icons to indicate boolean values. Make it easy to scan the configuration at a glance.",
                Some(vec!["sections", "boolean_icons", "organized_layout"])
            ))
        })
    })
}

pub fn list_site_variables_tool() -> Tool {
    tool_helpers::create_tool::<SiteListParams>(
        "rmm_list_site_variables",
        "🔧 [Advanced] List site variables. Returns formatted markdown with variable details.",
    )
}

pub fn list_site_variables_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SiteListParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let variables = client
                .list_site_variables_with_mcp(
                    &params.site_uid,
                    Some(datto_api::PaginationQuery {
                        page: params.page,
                        max: params.max,
                    }),
                    &mcp_headers,
                )
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list site variables: {}", e)))?;

            let vars = variables.variables.as_ref().map(|v| v.as_slice()).unwrap_or(&[]);

            if vars.is_empty() {
                let result_data = serde_json::json!({
                    "site_uid": &params.site_uid,
                    "variables": [],
                    "pagination": variables.page_details
                });
                return Ok(tool_helpers::instructed_result(
                    result_data,
                    "No variables configured for this site. Note this clearly.",
                    Some(vec!["no_results"])
                ));
            }

            let result_data = serde_json::json!({
                "site_uid": &params.site_uid,
                "variables": serde_json::to_value(vars).unwrap(),
                "pagination": variables.page_details,
                "count": vars.len()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present these site variables in a table format. Show variable name, value, and ID. Automatically mask sensitive values - if variable name contains 'password', 'secret', 'key', or similar, display as masked (e.g., 🔑 ***). Sort alphabetically by variable name. Make it easy to scan the configuration.",
                Some(vec!["variable_table", "sensitive_masking", "alphabetical_sort"])
            ))
        })
    })
}

pub fn list_site_resolved_alerts_tool() -> Tool {
    tool_helpers::create_tool::<SiteListParams>(
        "rmm_list_site_resolved_alerts",
        "🔧 [Advanced] List resolved alerts. Returns formatted markdown with alert history.",
    )
}

pub fn list_site_resolved_alerts_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SiteListParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client
                .list_site_resolved_alerts_with_mcp(
                    &params.site_uid,
                    Some(datto_api::PaginationQuery {
                        page: params.page,
                        max: params.max,
                    }),
                    &mcp_headers,
                )
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list resolved alerts: {}", e)))?;

            let alerts = data.alerts.as_ref().map(|a| a.as_slice()).unwrap_or(&[]);
            let count = data.page_details.as_ref().and_then(|p| p.count).unwrap_or(0);

            if count == 0 || alerts.is_empty() {
                let result_data = serde_json::json!({
                    "site_uid": &params.site_uid,
                    "alerts": [],
                    "pagination": data.page_details
                });
                return Ok(tool_helpers::instructed_result(
                    result_data,
                    "No resolved alerts for this site. Present this as a positive message.",
                    Some(vec!["no_alerts", "positive_indicator"])
                ));
            }

            let critical_count = alerts.iter().filter(|a| matches!(a.priority, Some(datto_api::Priority::Critical) | Some(datto_api::Priority::High))).count();
            let medium_count = alerts.iter().filter(|a| matches!(a.priority, Some(datto_api::Priority::Moderate))).count();
            let low_count = alerts.len() - critical_count - medium_count;

            let result_data = serde_json::json!({
                "site_uid": &params.site_uid,
                "alerts": serde_json::to_value(alerts).unwrap(),
                "pagination": data.page_details,
                "summary": {
                    "total": count,
                    "critical_high": critical_count,
                    "medium": medium_count,
                    "low": low_count
                }
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present these resolved alerts for the site (historical data). Show total count and severity breakdown. Group alerts by priority (critical/high first, then medium, then low) with severity icons. For each alert show device name, diagnostic message, and alert UID. This is historical data showing previously resolved issues.",
                Some(vec!["alert_history", "severity_grouping", "severity_icons", "priority_order"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct CreateSiteParams {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

pub fn create_site_tool() -> Tool {
    tool_helpers::create_tool::<CreateSiteParams>(
        "rmm_create_site",
        "🔧 [Advanced] Create a new site. Returns formatted confirmation.",
    )
}

pub fn create_site_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: CreateSiteParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let request = datto_api::CreateSiteRequest {
                name: params.name,
                description: params.description,
                ..Default::default()
            };

            let site = client
                .create_site_with_mcp(&request, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to create site: {}", e)))?;

            let result_data = serde_json::json!({
                "site": serde_json::to_value(&site).unwrap(),
                "created": true
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this site creation confirmation. Show success indicator, site name prominently, and the generated UID. If device status is available, show online/offline device counts. Make the success clear and provide the UID for reference in subsequent operations.",
                Some(vec!["success_confirmation", "site_details", "uid_prominent"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct UpdateSiteParams {
    pub site_uid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

pub fn update_site_tool() -> Tool {
    tool_helpers::create_tool::<UpdateSiteParams>(
        "rmm_update_site",
        "🔧 [Advanced] Update site information. Returns formatted confirmation.",
    )
}

pub fn update_site_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: UpdateSiteParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let mut site = client
                .get_site_with_mcp(&params.site_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get site: {}", e)))?;

            if let Some(name) = params.name {
                site.name = Some(name);
            }
            if let Some(description) = params.description {
                site.description = Some(description);
            }

            let updated = client
                .update_site_with_mcp(&params.site_uid, &site, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to update site: {}", e)))?;

            let result_data = serde_json::json!({
                "site": serde_json::to_value(&updated).unwrap(),
                "updated": true
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this site update confirmation. Show success indicator, updated site name, and UID. If device status is available, show current online/offline device counts. Make the success clear.",
                Some(vec!["success_confirmation", "site_details"])
            ))
        })
    })
}

pub fn list_site_filters_tool() -> Tool {
    tool_helpers::create_tool::<SiteUidParams>(
        "rmm_list_site_filters",
        "🔧 [Advanced] List site device filters. Returns formatted markdown with filter details.",
    )
}

pub fn list_site_filters_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SiteUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client
                .list_site_filters_with_mcp(&params.site_uid, None, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list site filters: {}", e)))?;

            let filters = data.filters.as_ref().map(|f| f.as_slice()).unwrap_or(&[]);

            if filters.is_empty() {
                let result_data = serde_json::json!({
                    "site_uid": &params.site_uid,
                    "filters": [],
                    "pagination": data.page_details
                });
                return Ok(tool_helpers::instructed_result(
                    result_data,
                    "No device filters configured for this site. Note this clearly.",
                    Some(vec!["no_results"])
                ));
            }

            let result_data = serde_json::json!({
                "site_uid": &params.site_uid,
                "filters": serde_json::to_value(filters).unwrap(),
                "pagination": data.page_details,
                "count": filters.len()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present these site device filters in a table format. Show filter name, type, and ID/UID. List all filters clearly for easy reference.",
                Some(vec!["filter_table", "filter_list"])
            ))
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn site_uid_params_required() {
        let p: SiteUidParams =
            serde_json::from_value(serde_json::json!({"site_uid": "site-abc"})).unwrap();
        assert_eq!(p.site_uid, "site-abc");
    }

    #[test]
    fn site_uid_params_missing_fails() {
        assert!(serde_json::from_value::<SiteUidParams>(serde_json::json!({})).is_err());
    }

    #[test]
    fn site_list_params_optional_fields_default_none() {
        let p: SiteListParams =
            serde_json::from_value(serde_json::json!({"site_uid": "s1"})).unwrap();
        assert!(p.page.is_none());
        assert!(p.max.is_none());
    }

    #[test]
    fn site_list_params_with_pagination() {
        let p: SiteListParams =
            serde_json::from_value(serde_json::json!({"site_uid": "s1", "page": 2, "max": 50}))
                .unwrap();
        assert_eq!(p.page, Some(2));
        assert_eq!(p.max, Some(50));
    }

    #[test]
    fn create_site_params_name_required_description_optional() {
        let p: CreateSiteParams =
            serde_json::from_value(serde_json::json!({"name": "My Site"})).unwrap();
        assert_eq!(p.name, "My Site");
        assert!(p.description.is_none());
    }

    #[test]
    fn create_site_params_with_description() {
        let p: CreateSiteParams =
            serde_json::from_value(serde_json::json!({"name": "Site A", "description": "Main HQ"}))
                .unwrap();
        assert_eq!(p.description, Some("Main HQ".into()));
    }

    #[test]
    fn update_site_params_only_uid_required() {
        let p: UpdateSiteParams =
            serde_json::from_value(serde_json::json!({"site_uid": "uid-1"})).unwrap();
        assert_eq!(p.site_uid, "uid-1");
        assert!(p.name.is_none());
        assert!(p.description.is_none());
    }
}
