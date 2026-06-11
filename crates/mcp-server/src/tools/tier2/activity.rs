//! Tier 2: Activity API tools

use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::{DattoClient, McpCallHeaders};
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct PaginationParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<i32>,
}

pub fn get_activity_logs_tool() -> Tool {
    tool_helpers::create_tool::<PaginationParams>(
        "get-activity-logs",
        "🔧 [Advanced] Get account activity logs. Returns formatted markdown with activity timeline.",
    )
}

pub fn get_activity_logs_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: PaginationParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let logs = client
                .list_activity_logs_with_mcp(
                    Some(datto_api::PaginationQuery {
                        page: params.page,
                        max: params.max,
                    }),
                    &mcp_headers,
                )
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get activity logs: {}", e)))?;

            let data = serde_json::to_value(&logs)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Analyze this activity log data and present it as a chronological list to the user. Use icons to indicate activity type (jobs, configuration changes, user actions, etc.). Show the action performed, the target device/hostname, and the site name. Extract meaningful details from the activity details JSON where available. Make recent critical activities easy to spot. Group by category if it helps readability.",
                Some(vec!["chronological_list", "activity_icons", "detail_extraction", "category_grouping"])
            ))
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pagination_params_all_optional() {
        let p: PaginationParams = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(p.page.is_none());
        assert!(p.max.is_none());
    }

    #[test]
    fn pagination_params_with_values() {
        let p: PaginationParams =
            serde_json::from_value(serde_json::json!({"page": 5, "max": 200})).unwrap();
        assert_eq!(p.page, Some(5));
        assert_eq!(p.max, Some(200));
    }
}
