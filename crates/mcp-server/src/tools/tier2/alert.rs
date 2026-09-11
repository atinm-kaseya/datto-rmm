//! Tier 2: Alert API tools

use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::{DattoClient, McpCallHeaders};
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AlertUidParams {
    pub alert_uid: String,
}

pub fn get_alert_tool() -> Tool {
    tool_helpers::create_tool::<AlertUidParams>(
        "rmm_get_alert",
        "🔧 [Advanced] Get alert details. Returns formatted markdown with alert information.",
    )
}

pub fn get_alert_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: AlertUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let alert = client
                .get_alert_with_mcp(&params.alert_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get alert: {}", e)))?;

            let priority_icon = match alert.priority {
                Some(datto_api::Priority::Critical) => "🔴",
                Some(datto_api::Priority::High) => "🟠",
                Some(datto_api::Priority::Moderate) => "🟡",
                _ => "🟢",
            };

            let mut summary = format!(
                "# {} Alert\n\n**UID:** `{}`\n",
                priority_icon,
                alert.alert_uid.as_deref().unwrap_or("N/A")
            );

            let resolved_status = if alert.resolved.unwrap_or(false) { "✅" } else { "❌" };
            let muted_status = if alert.muted.unwrap_or(false) { "✅" } else { "❌" };

            summary.push_str(&format!("**Resolved:** {}\n", resolved_status));
            summary.push_str(&format!("**Muted:** {}\n\n", muted_status));

            let device_name = alert.alert_source_info.as_ref()
                .and_then(|s| s.device_name.as_deref())
                .unwrap_or("Unknown");
            let site_name = alert.alert_source_info.as_ref()
                .and_then(|s| s.site_name.as_deref())
                .unwrap_or("Unknown");

            summary.push_str(&format!("**Device:** {}\n", device_name));
            summary.push_str(&format!("**Site:** {}\n\n", site_name));

            if let Some(diagnostics) = &alert.diagnostics {
                summary.push_str(&format!("## Diagnostics\n\n{}\n\n", diagnostics));
            }

            if let Some(ticket) = &alert.ticket_number {
                summary.push_str(&format!("**Ticket:** {}\n", ticket));
            }

            let data = serde_json::to_value(&alert)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present this alert's detailed information. Show priority prominently with appropriate severity icon (red for Critical, orange for High, yellow for Moderate, green for Low). Display alert UID for reference. Show resolved and muted status with checkmarks or X marks. Include device name and site name for context. Display diagnostic message clearly. If a ticket number exists, show it. Make the priority and resolved status immediately visible.",
                Some(vec!["priority_icon", "status_indicators", "device_site_context", "diagnostics_display"])
            ))
        })
    })
}

pub fn resolve_alert_tool() -> Tool {
    tool_helpers::create_tool::<AlertUidParams>(
        "rmm_resolve_alert",
        "🔧 [Advanced] Mark an alert as resolved",
    )
}

pub fn resolve_alert_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: AlertUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            client
                .resolve_alert_with_mcp(&params.alert_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to resolve alert: {}", e)))?;

            let result_data = serde_json::json!({
                "alert_uid": &params.alert_uid,
                "action": "resolved",
                "status": "success"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present a clear confirmation that the alert was successfully resolved. Show the alert UID and use a success indicator (green checkmark). Keep it brief and positive.",
                Some(vec!["success_confirmation", "action_complete"])
            ))
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alert_uid_params_required() {
        let p: AlertUidParams =
            serde_json::from_value(serde_json::json!({"alert_uid": "alert-xyz"})).unwrap();
        assert_eq!(p.alert_uid, "alert-xyz");
    }

    #[test]
    fn alert_uid_params_missing_fails() {
        assert!(serde_json::from_value::<AlertUidParams>(serde_json::json!({})).is_err());
    }
}
