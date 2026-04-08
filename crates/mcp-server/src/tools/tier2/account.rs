//! Tier 2: Account-level API tools

use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::DattoClient;
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

pub fn get_account_tool() -> Tool {
    tool_helpers::create_tool_no_params(
        "get-account",
        "🔧 [Advanced] Get account information. Returns formatted markdown with account name, UID in backticks, and device status with 🟢/🔴 icons.",
    )
}

pub fn get_account_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, _args: Value| {
        Box::pin(async move {
            let account = client
                .get_account()
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get account: {}", e)))?;

            let data = serde_json::to_value(&account)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Analyze this account data and present a clear overview to the user. Show the account name prominently, include the UID for reference, and visualize the device status with appropriate icons (green for online, red for offline). Calculate and display the percentage of devices online. Format this as a professional dashboard summary.",
                Some(vec!["heading", "progress_bar", "status_icons", "percentage_calculation"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct ListSitesParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<i32>,
}

pub fn list_sites_tool() -> Tool {
    tool_helpers::create_tool::<ListSitesParams>(
        "list-sites",
        "🔧 [Advanced] List sites. Returns formatted markdown with health icons 🟢🟡🔴, site names, device counts, and UIDs in backticks for follow-up queries.",
    )
}

pub fn list_sites_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: ListSitesParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let sites_data = client
                .list_sites(Some(datto_api::PaginationQuery {
                    page: params.page,
                    max: params.max,
                }))
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list sites: {}", e)))?;

            let data = serde_json::to_value(&sites_data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Analyze this list of sites and present them to the user with health-based visual indicators. Use green icons for sites with all devices online, yellow for sites with some offline, and red for sites with many offline devices. Group or sort by health status if helpful. Include device counts and site UIDs for reference. Make it easy to identify which sites need attention.",
                Some(vec!["list", "health_icons", "device_counts", "status_grouping"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct ListDevicesParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<i32>,
}

pub fn list_devices_tool() -> Tool {
    tool_helpers::create_tool::<ListDevicesParams>(
        "list-devices",
        "🔧 [Advanced] List devices. Returns formatted table with 🟢/🔴 status, hostname, type, site. Device UIDs can be extracted for follow-up queries.",
    )
}

pub fn list_devices_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: ListDevicesParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let devices_data = client
                .list_devices(Some(datto_api::PaginationQuery {
                    page: params.page,
                    max: params.max,
                }))
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list devices: {}", e)))?;

            let data = serde_json::to_value(&devices_data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Analyze this device list and present it as a formatted table to the user. Include status indicators (online/offline), hostname, device type, and site name. Add a summary at the top showing total devices and online/offline breakdown. Use visual indicators to make the online/offline status immediately clear.",
                Some(vec!["table", "status_icons", "summary_stats"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct ListAlertsParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<i32>,
}

pub fn list_open_alerts_tool() -> Tool {
    tool_helpers::create_tool::<ListAlertsParams>(
        "list-open-alerts",
        "🔧 [Advanced] List open alerts. Returns formatted markdown grouped by priority 🔴🟠🟡🟢 with alert messages, devices, and sites. Alert UIDs can be extracted for investigation.",
    )
}

pub fn list_open_alerts_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: ListAlertsParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let alerts_data = client
                .list_open_alerts(Some(datto_api::PaginationQuery {
                    page: params.page,
                    max: params.max,
                }))
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list alerts: {}", e)))?;

            let data = serde_json::to_value(&alerts_data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Analyze this list of open alerts and organize them by priority for the user. Use severity icons (red for Critical, orange for High, yellow for Moderate, green for Low). Group alerts by priority and show count summaries. For each alert, display device name, site name, and diagnostic message. Make it easy to identify the most critical issues first.",
                Some(vec!["priority_grouping", "severity_icons", "count_summary"])
            ))
        })
    })
}

pub fn list_resolved_alerts_tool() -> Tool {
    tool_helpers::create_tool::<ListAlertsParams>(
        "list-resolved-alerts",
         "🔧 [Advanced] List resolved alerts. Returns formatted table with priority icons 🔴🟠🟡🟢, device, site, and alert type.",
    )
}

pub fn list_resolved_alerts_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: ListAlertsParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let alerts_data = client
                .list_resolved_alerts(Some(datto_api::PaginationQuery {
                    page: params.page,
                    max: params.max,
                }))
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list resolved alerts: {}", e)))?;

            let data = serde_json::to_value(&alerts_data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Analyze this list of resolved alerts and present them as a table to the user. Include priority icons (red for Critical, orange for High, yellow for Moderate, green for Low), device name, site name, and alert type. Show total count at the top. Make it easy to review recent resolution history.",
                Some(vec!["table", "priority_icons", "count_summary"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct PaginationParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<i32>,
}

pub fn list_components_tool() -> Tool {
    tool_helpers::create_tool::<PaginationParams>(
        "list-components",
        "🔧 [Advanced] List available job components. Returns formatted markdown grouped by category with component names, descriptions, and UIDs in backticks.",
    )
}

pub fn list_components_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: PaginationParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client
                .list_components(Some(datto_api::PaginationQuery {
                    page: params.page,
                    max: params.max,
                }))
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list components: {}", e)))?;

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Analyze this list of job components and present them organized by category to the user. Group components by their category code and show count summaries for each category. For each component, display the name prominently, include a brief description, and show the UID for reference. Make it easy to browse components by type.",
                Some(vec!["category_grouping", "count_summary", "component_details"])
            ))
        })
    })
}

pub fn list_account_variables_tool() -> Tool {
    tool_helpers::create_tool::<PaginationParams>(
        "list-account-variables",
        "🔧 [Advanced] List account variables. Returns formatted table with variable names, values (🔑 for sensitive), and IDs in backticks.",
    )
}

pub fn list_account_variables_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: PaginationParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client
                .list_account_variables(Some(datto_api::PaginationQuery {
                    page: params.page,
                    max: params.max,
                }))
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list account variables: {}", e)))?;

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Analyze this list of account variables and present them as a table to the user. Show variable name, value, and ID. For variables with sensitive names (containing 'key', 'password', 'secret', or 'token'), use a key icon and mask the value with asterisks (***). Make it clear which variables contain sensitive data.",
                Some(vec!["table", "sensitive_masking", "key_icons"])
            ))
        })
    })
}

pub fn list_users_tool() -> Tool {
    tool_helpers::create_tool::<PaginationParams>(
        "list-users",
        "🔧 [Advanced] List users. Returns formatted table with ✅/🔴 status, username, name, and email.",
    )
}

pub fn list_users_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: PaginationParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client
                .list_users(Some(datto_api::PaginationQuery {
                    page: params.page,
                    max: params.max,
                }))
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list users: {}", e)))?;

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Analyze this list of users and present them as a table to the user. Show status with icons (green checkmark for active, red circle for disabled), username, full name, and email. Include a summary at the top showing total users and how many are active vs disabled. Make it easy to identify disabled accounts.",
                Some(vec!["table", "status_icons", "count_summary", "active_disabled_split"])
            ))
        })
    })
}
