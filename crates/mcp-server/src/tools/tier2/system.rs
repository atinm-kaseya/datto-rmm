//! Tier 2: System and Filter API tools

use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::{DattoClient, McpCallHeaders};
use rmcp::model::Tool;
use serde_json::Value;
use std::sync::Arc;

pub fn get_system_status_tool() -> Tool {
    tool_helpers::create_tool_no_params(
        "get-system-status",
        "🔧 [Advanced] Get Datto RMM system status. Returns StatusResponse JSON with: version, status string. Format as: **Version**: version number, **Status**: status with ✅ if OK, 🔴 if error. Keep concise.",
    )
}

pub fn get_system_status_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, _args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let data = client
                .get_system_status_with_mcp(&mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get system status: {}", e)))?;

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Present this Datto RMM system status concisely. Show the version number prominently. Display status with a green checkmark if OK, red circle if error. Include the start time converted to a readable format. Keep it brief and clear.",
                Some(vec!["version_prominent", "status_icon", "timestamp_conversion"])
            ))
        })
    })
}

pub fn get_rate_limit_tool() -> Tool {
    tool_helpers::create_tool_no_params(
        "get-rate-limit",
        "🔧 [Advanced] Get API rate limit info. Returns RateStatusResponse JSON with: limit (requests per period), remaining, resetTime epoch, current usage. Format as: **Limit**: X requests/period, **Remaining**: Y (🟢 if >50%, 🟡 if 20-50%, 🔴 if <20%), **Resets**: time (convert epoch), **Usage**: progress bar or percentage. Warn if near limit.",
    )
}

pub fn get_rate_limit_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, _args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let data = client
                .get_rate_limit_info_with_mcp(&mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get rate limit info: {}", e)))?;

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Present this API rate limit information clearly. Show the limit (requests per period) and remaining requests. Calculate and display percentage remaining. Use color indicators: green if over 50% remaining, yellow if 20-50%, red if under 20%. Convert the reset time from epoch to readable format. Add a warning if close to the limit. Include a visual progress bar or percentage display.",
                Some(vec!["limit_display", "percentage_calculation", "color_indicators", "timestamp_conversion", "progress_bar", "warning_if_low"])
            ))
        })
    })
}

pub fn get_pagination_config_tool() -> Tool {
    tool_helpers::create_tool_no_params(
        "get-pagination-config",
        "🔧 [Advanced] Get pagination configuration. Returns JSON - format as key-value pairs: Default Page Size, Max Page Size, Total Pages (if available), Current Page Settings. Present clearly and concisely.",
    )
}

pub fn get_pagination_config_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, _args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let data = client
                .get_pagination_config_with_mcp(&mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get pagination config: {}", e)))?;

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Present this pagination configuration as a clean list of key-value pairs. Show default page size, maximum page size, and any current page settings. Make it easy to scan the limits at a glance.",
                Some(vec!["key_value_list", "size_limits"])
            ))
        })
    })
}

pub fn list_default_filters_tool() -> Tool {
    tool_helpers::create_tool_no_params(
        "list-default-filters",
        "🔧 [Advanced] List default device filters. Returns JSON - format as table with columns: Filter Name, UID, Criteria/Conditions, Type (default), Active/Enabled status. Sort by name.",
    )
}

pub fn list_default_filters_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, _args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let data = client
                .list_default_filters_with_mcp(None, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list default filters: {}", e)))?;

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Present this list of default device filters as a table. Include columns for filter name, UID (for reference), criteria/conditions summary, and active/enabled status. Sort by name for easy browsing. Use icons to indicate whether each filter is active.",
                Some(vec!["table", "status_icons", "sort_by_name", "criteria_summary"])
            ))
        })
    })
}

pub fn list_custom_filters_tool() -> Tool {
    tool_helpers::create_tool_no_params(
        "list-custom-filters",
        "🔧 [Advanced] List custom device filters. Returns JSON - format as table with columns: Filter Name, UID, Criteria/Conditions, Creator/Owner, Active/Enabled status. Sort by name.",
    )
}

pub fn list_custom_filters_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, _args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let data = client
                .list_custom_filters_with_mcp(None, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list custom filters: {}", e)))?;

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Present this list of custom device filters as a table. Include columns for filter name, UID (for reference), criteria/conditions summary, creator/owner information, and active/enabled status. Sort by name for easy browsing. Use icons to indicate whether each filter is active.",
                Some(vec!["table", "status_icons", "sort_by_name", "owner_info", "criteria_summary"])
            ))
        })
    })
}
