//! Tier 2: Device-level API tools

use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::{DattoClient, McpCallHeaders};
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct DeviceUidParams {
    pub device_uid: String,
}

pub fn get_device_tool() -> Tool {
    tool_helpers::create_tool::<DeviceUidParams>(
        "get-device",
        "🔧 [Advanced] Get device info. Returns formatted markdown with device details.",
    )
}

pub fn get_device_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: DeviceUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let device = client
                .get_device_with_mcp(&params.device_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get device: {}", e)))?;

            let data = serde_json::to_value(&device)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Analyze this device data and present a comprehensive device overview. Show the hostname as a heading, include a prominent online/offline status indicator, and organize key details like OS, device type, IP addresses, and site name. Include the UID for reference. If there are any notable states (suspended, reboot required, deleted), highlight those. Make the current status very clear at a glance.",
                Some(vec!["heading", "status_badge", "key_value_pairs", "state_highlighting"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct DeviceListParams {
    pub device_uid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<i32>,
}

pub fn list_device_open_alerts_tool() -> Tool {
    tool_helpers::create_tool::<DeviceListParams>(
        "list-device-open-alerts",
        "🔧 [Advanced] List device open alerts. Returns formatted markdown with alert details.",
    )
}

pub fn list_device_open_alerts_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: DeviceListParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let alerts_data = client
                .list_device_open_alerts_with_mcp(
                    &params.device_uid,
                    Some(datto_api::PaginationQuery {
                        page: params.page,
                        max: params.max,
                    }),
                    &mcp_headers,
                )
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list device alerts: {}", e)))?;

            let alerts = alerts_data.alerts.as_ref().map(|a| a.as_slice()).unwrap_or(&[]);

            if alerts.is_empty() {
                let result_data = serde_json::json!({
                    "device_uid": &params.device_uid,
                    "open_alerts": [],
                    "count": 0
                });
                return Ok(tool_helpers::instructed_result(
                    result_data,
                    "Present a positive message that this device has no open alerts. Use a success indicator (green checkmark). Keep it brief and clear.",
                    Some(vec!["no_alerts_message", "success_indicator"])
                ));
            }

            let data = serde_json::to_value(&alerts_data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present this list of open alerts for the device. Show total count at the top. For each alert display priority icon (red for Critical/High, yellow for Moderate, green for Low/Info), alert UID for reference, and diagnostic message (truncate if very long). If an alert is muted, show a mute icon. Make critical/high priority alerts stand out.",
                Some(vec!["alert_list", "priority_icons", "count_summary", "diagnostic_truncation", "muted_indicators"])
            ))
        })
    })
}

pub fn list_device_resolved_alerts_tool() -> Tool {
    tool_helpers::create_tool::<DeviceListParams>(
        "list-device-resolved-alerts",
        "🔧 [Advanced] List device resolved alerts. Returns formatted markdown with alert history.",
    )
}

pub fn list_device_resolved_alerts_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: DeviceListParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client
                .list_device_resolved_alerts_with_mcp(
                    &params.device_uid,
                    Some(datto_api::PaginationQuery {
                        page: params.page,
                        max: params.max,
                    }),
                    &mcp_headers,
                )
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to list resolved alerts: {}", e)))?;

            let alerts = data.alerts.as_ref().map(|a| a.as_slice()).unwrap_or(&[]);

            if alerts.is_empty() {
                let result_data = serde_json::json!({
                    "device_uid": &params.device_uid,
                    "resolved_alerts": [],
                    "count": 0
                });
                return Ok(tool_helpers::instructed_result(
                    result_data,
                    "Present a positive message that this device has no resolved alerts in the query timeframe. Use a success indicator. Keep it brief.",
                    Some(vec!["no_alerts_message", "success_indicator"])
                ));
            }

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Present this list of resolved alerts for the device as a resolution history. Show total count at the top. For each alert display priority icon (red for Critical/High, yellow for Moderate, green for Low), alert UID for reference, and ticket number if present. This represents the device's alert resolution history.",
                Some(vec!["alert_history", "priority_icons", "count_summary", "ticket_display"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct DeviceIdParams {
    pub device_id: i32,
}

pub fn get_device_by_id_tool() -> Tool {
    tool_helpers::create_tool::<DeviceIdParams>(
        "get-device-by-id",
        "🔧 [Advanced] Lookup device by ID. Returns formatted markdown with device details.",
    )
}

pub fn get_device_by_id_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: DeviceIdParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let device = client
                .get_device_by_id_with_mcp(params.device_id as i64, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get device by ID: {}", e)))?;

            let data = serde_json::to_value(&device)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present this device information looked up by ID. Show hostname prominently as heading. Display online/offline status with appropriate icon (green for online, red for offline). Show device UID, site name, operating system, and IP addresses. Include portal URL and remote access URL if available. Make the status immediately visible.",
                Some(vec!["device_overview", "status_prominent", "connection_urls", "network_info"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct MacAddressParams {
    pub mac_address: String,
}

pub fn get_device_by_mac_tool() -> Tool {
    tool_helpers::create_tool::<MacAddressParams>(
        "get-device-by-mac",
        "🔧 [Advanced] Lookup device by MAC address. Returns formatted markdown with device details.",
    )
}

pub fn get_device_by_mac_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: MacAddressParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let device = client
                .get_device_by_mac_with_mcp(&params.mac_address, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get device by MAC: {}", e)))?;

            let data = serde_json::to_value(&device)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present this device information looked up by MAC address. Show hostname prominently as heading, display the MAC address used for lookup. Show online/offline status with appropriate icon (green for online, red for offline). Display device UID, site name, operating system, and internal IP address. Make the status immediately visible.",
                Some(vec!["device_overview", "mac_address_context", "status_prominent", "network_info"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct MoveDeviceParams {
    pub device_uid: String,
    pub target_site_uid: String,
}

pub fn move_device_tool() -> Tool {
    tool_helpers::create_tool::<MoveDeviceParams>(
        "move-device",
        "🔧 [Advanced] Move device to another site",
    )
}

pub fn move_device_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: MoveDeviceParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            client
                .move_device_with_mcp(&params.device_uid, &params.target_site_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to move device: {}", e)))?;

            let result_data = serde_json::json!({
                "device_uid": &params.device_uid,
                "target_site_uid": &params.target_site_uid,
                "action": "moved",
                "status": "success"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present a clear confirmation that the device was successfully moved to the new site. Show both the device UID and target site UID for reference. Use a success indicator (green checkmark). Note that the device is now part of the new site.",
                Some(vec!["success_confirmation", "move_complete", "uid_references"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct SetDeviceUdfParams {
    pub device_uid: String,
    pub udf: serde_json::Map<String, Value>,
}

pub fn set_device_udf_tool() -> Tool {
    tool_helpers::create_tool::<SetDeviceUdfParams>(
        "set-device-udf",
        "🔧 [Advanced] Set device user-defined fields",
    )
}

pub fn set_device_udf_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SetDeviceUdfParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let udf = datto_api::Udf::default();
            client
                .set_device_udf_with_mcp(&params.device_uid, &udf, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to set device UDF: {}", e)))?;

            let result_data = serde_json::json!({
                "device_uid": &params.device_uid,
                "udf_fields": params.udf,
                "action": "udf_updated",
                "status": "success"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present a clear confirmation that the device user-defined fields were successfully updated. Show the device UID and list the UDF fields that were set. Use a success indicator (green checkmark).",
                Some(vec!["success_confirmation", "udf_fields_list"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct SetDeviceWarrantyParams {
    pub device_uid: String,
    pub warranty_date: String,
}

pub fn set_device_warranty_tool() -> Tool {
    tool_helpers::create_tool::<SetDeviceWarrantyParams>(
        "set-device-warranty",
        "🔧 [Advanced] Set device warranty date",
    )
}

pub fn set_device_warranty_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: SetDeviceWarrantyParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let warranty = datto_api::Warranty {
                warranty_date: Some(params.warranty_date.clone()),
            };
            client
                .set_device_warranty_with_mcp(&params.device_uid, &warranty, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to set device warranty: {}", e)))?;

            let result_data = serde_json::json!({
                "device_uid": &params.device_uid,
                "warranty_date": &params.warranty_date,
                "action": "warranty_updated",
                "status": "success"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present a clear confirmation that the device warranty date was successfully set. Show the device UID and the warranty date prominently. Use a success indicator (green checkmark). Consider showing a calendar icon with the warranty date.",
                Some(vec!["success_confirmation", "warranty_date_display", "calendar_icon"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct CreateQuickJobParams {
    pub device_uid: String,
    pub job_name: String,
}

pub fn create_quick_job_tool() -> Tool {
    tool_helpers::create_tool::<CreateQuickJobParams>(
        "create-quick-job",
        "🔧 [Advanced] Create and execute a quick job on a device. Returns formatted confirmation.",
    )
}

pub fn create_quick_job_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: CreateQuickJobParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let job_component = datto_api::JobComponentRequest::default();
            let request = datto_api::CreateQuickJobRequest {
                job_name: params.job_name.clone(),
                job_component: Box::new(job_component),
            };
            let response = client
                .create_quick_job_with_mcp(&params.device_uid, &request, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to create quick job: {}", e)))?;

            let data = serde_json::to_value(&response)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present a clear confirmation that the quick job was successfully created and is now executing. Show job name prominently, display the job UID for tracking, and show current job status with a status icon (gears/running icon). Note that the job is now running on the device. Make it clear this is a quick/immediate execution job.",
                Some(vec!["success_confirmation", "job_created", "job_uid_display", "status_icon", "execution_indicator"])
            ))
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_uid_params_required() {
        let p: DeviceUidParams =
            serde_json::from_value(serde_json::json!({"device_uid": "abc-123"})).unwrap();
        assert_eq!(p.device_uid, "abc-123");
    }

    #[test]
    fn device_uid_params_missing_fails() {
        let result: Result<DeviceUidParams, _> =
            serde_json::from_value(serde_json::json!({}));
        assert!(result.is_err());
    }

    #[test]
    fn device_list_params_page_max_optional() {
        let p: DeviceListParams =
            serde_json::from_value(serde_json::json!({"device_uid": "uid-1"})).unwrap();
        assert_eq!(p.device_uid, "uid-1");
        assert!(p.page.is_none());
        assert!(p.max.is_none());
    }

    #[test]
    fn device_list_params_with_pagination() {
        let p: DeviceListParams =
            serde_json::from_value(serde_json::json!({"device_uid": "uid-1", "page": 3, "max": 50}))
                .unwrap();
        assert_eq!(p.page, Some(3));
        assert_eq!(p.max, Some(50));
    }

    #[test]
    fn move_device_params_both_required() {
        let p: MoveDeviceParams = serde_json::from_value(serde_json::json!({
            "device_uid": "dev-1",
            "target_site_uid": "site-2"
        }))
        .unwrap();
        assert_eq!(p.device_uid, "dev-1");
        assert_eq!(p.target_site_uid, "site-2");
    }

    #[test]
    fn set_device_warranty_params_required() {
        let p: SetDeviceWarrantyParams = serde_json::from_value(serde_json::json!({
            "device_uid": "dev-1",
            "warranty_date": "2026-12-31"
        }))
        .unwrap();
        assert_eq!(p.warranty_date, "2026-12-31");
    }

    #[test]
    fn device_id_params_integer() {
        let p: DeviceIdParams =
            serde_json::from_value(serde_json::json!({"device_id": 42})).unwrap();
        assert_eq!(p.device_id, 42);
    }

    #[test]
    fn create_quick_job_params_required() {
        let p: CreateQuickJobParams = serde_json::from_value(serde_json::json!({
            "device_uid": "dev-1",
            "job_name": "disk-cleanup"
        }))
        .unwrap();
        assert_eq!(p.job_name, "disk-cleanup");
    }
}
