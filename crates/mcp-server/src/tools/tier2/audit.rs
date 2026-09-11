//! Tier 2: Audit API tools

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

pub fn get_device_audit_tool() -> Tool {
    tool_helpers::create_tool::<DeviceUidParams>(
        "rmm_get_device_audit",
        "🔧 [Advanced] Get device hardware audit. Returns formatted markdown with hardware details.",
    )
}

pub fn get_device_audit_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: DeviceUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let audit = client
                .get_device_audit_with_mcp(&params.device_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get device audit: {}", e)))?;

            let result_data = serde_json::json!({
                "device_uid": &params.device_uid,
                "audit": serde_json::to_value(&audit).unwrap()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this comprehensive device hardware audit. If quick links (portal/remote URLs) are available, show them prominently. Display system information including manufacturer, model, CPU cores, RAM (convert bytes to GB), and .NET version. Show disk information in a table with drive letter, total space, free space, used percentage, and status indicator (red if >90% used, yellow if >75%, green otherwise). List network adapters with IP addresses and MAC addresses. Make low disk space warnings immediately visible.",
                Some(vec!["hardware_details", "disk_table", "disk_usage_indicators", "network_info", "storage_warnings"])
            ))
        })
    })
}

pub fn get_device_software_tool() -> Tool {
    tool_helpers::create_tool::<DeviceUidParams>(
        "rmm_get_device_software",
        "🔧 [Advanced] Get installed software. Returns formatted markdown table.",
    )
}

pub fn get_device_software_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: DeviceUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let software = client
                .get_device_software_with_mcp(&params.device_uid, None, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get device software: {}", e)))?;

            let apps = software.software.as_ref().map(|a| a.as_slice()).unwrap_or(&[]);

            if apps.is_empty() {
                let result_data = serde_json::json!({
                    "device_uid": &params.device_uid,
                    "software": [],
                    "pagination": software.page_details
                });
                return Ok(tool_helpers::instructed_result(
                    result_data,
                    "No software found on this device. Present this clearly.",
                    Some(vec!["no_results"])
                ));
            }

            let result_data = serde_json::json!({
                "device_uid": &params.device_uid,
                "software": serde_json::to_value(apps).unwrap(),
                "pagination": software.page_details,
                "total_count": apps.len()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this installed software list as a table showing application names and versions. Show total count prominently. If there are many applications (>20), display the first 20 and note how many more exist. Sort alphabetically by name for easy scanning.",
                Some(vec!["software_table", "alphabetical_sort", "count_summary"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct MacAddressParams {
    pub mac_address: String,
}

pub fn get_device_audit_by_mac_tool() -> Tool {
    tool_helpers::create_tool::<MacAddressParams>(
        "rmm_get_device_audit_by_mac",
        "🔧 [Advanced] Get device audit by MAC address. Returns formatted markdown with hardware details.",
    )
}

pub fn get_device_audit_by_mac_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: MacAddressParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client
                .get_device_audit_by_mac_with_mcp(&params.mac_address, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get device audit by MAC: {}", e)))?;

            let result_data = serde_json::json!({
                "mac_address": &params.mac_address,
                "audit": serde_json::to_value(&data).unwrap()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this device audit data retrieved by MAC address. Show the MAC address prominently. Display system information including manufacturer, model, CPU cores, and RAM (convert bytes to GB). List network information including IP addresses and MAC addresses. Make the device identification clear.",
                Some(vec!["hardware_details", "mac_lookup", "system_info", "network_info"])
            ))
        })
    })
}

pub fn get_esxi_audit_tool() -> Tool {
    tool_helpers::create_tool::<DeviceUidParams>(
        "rmm_get_esxi_audit",
        "🔧 [Advanced] Get ESXi host audit data. Returns formatted markdown with ESXi details.",
    )
}

pub fn get_esxi_audit_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: DeviceUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client
                .get_esxi_audit_with_mcp(&params.device_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get ESXi audit: {}", e)))?;

            let result_data = serde_json::json!({
                "device_uid": &params.device_uid,
                "esxi_audit": serde_json::to_value(&data).unwrap()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this ESXi host audit data. Show the device UID for reference. Extract and display ESXi-specific information including host version, configuration, virtual machines, and resource allocation. Format the data clearly for ESXi infrastructure monitoring.",
                Some(vec!["esxi_details", "virtualization_info", "resource_summary"])
            ))
        })
    })
}

pub fn get_printer_audit_tool() -> Tool {
    tool_helpers::create_tool::<DeviceUidParams>(
        "rmm_get_printer_audit",
        "🔧 [Advanced] Get printer audit data. Returns formatted markdown with printer details.",
    )
}

pub fn get_printer_audit_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value, mcp_headers: McpCallHeaders| {
        Box::pin(async move {
            let params: DeviceUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client
                .get_printer_audit_with_mcp(&params.device_uid, &mcp_headers)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get printer audit: {}", e)))?;

            let result_data = serde_json::json!({
                "device_uid": &params.device_uid,
                "printer_audit": serde_json::to_value(&data).unwrap()
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this printer audit data. Show the device UID for reference. Extract and display printer-specific information including model, status, page counts, toner/ink levels if available, and network configuration. Format the data clearly for printer fleet management.",
                Some(vec!["printer_details", "status_info", "supply_levels"])
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
            serde_json::from_value(serde_json::json!({"device_uid": "dev-1"})).unwrap();
        assert_eq!(p.device_uid, "dev-1");
    }

    #[test]
    fn mac_address_params_required() {
        let p: MacAddressParams =
            serde_json::from_value(serde_json::json!({"mac_address": "AA:BB:CC:DD:EE:FF"}))
                .unwrap();
        assert_eq!(p.mac_address, "AA:BB:CC:DD:EE:FF");
    }

    #[test]
    fn mac_address_params_missing_fails() {
        assert!(serde_json::from_value::<MacAddressParams>(serde_json::json!({})).is_err());
    }
}
