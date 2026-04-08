//! Tier 2: Variable and Proxy API tools

use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::DattoClient;
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

// Account variable operations
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct CreateAccountVariableParams {
    pub name: String,
    pub value: String,
}

pub fn create_account_variable_tool() -> Tool {
    tool_helpers::create_tool::<CreateAccountVariableParams>(
        "create-account-variable",
        "🔧 [Advanced] Create account-level variable. Returns Variable JSON with: name, value, id. Format as: ✅ Variable '{name}' created with value: {value} (ID: {id}).",
    )
}

pub fn create_account_variable_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: CreateAccountVariableParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let request = datto_api::VariableCreationRequest {
                name: Some(params.name.clone()),
                value: Some(params.value.clone()),
                ..Default::default()
            };
            let variable = client.create_account_variable(&request).await
                .map_err(|e| crate::Error::Api(format!("Failed to create account variable: {}", e)))?;

            let data = serde_json::to_value(&variable)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present a clear confirmation that the account variable was successfully created. Show the variable name prominently, display the value (mask if it appears sensitive based on name containing 'key', 'password', 'secret', or 'token'), and include the variable ID for reference. Use a success indicator (green checkmark).",
                Some(vec!["success_confirmation", "variable_details", "sensitive_masking"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct UpdateAccountVariableParams {
    pub variable_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

pub fn update_account_variable_tool() -> Tool {
    tool_helpers::create_tool::<UpdateAccountVariableParams>(
        "update-account-variable",
        "🔧 [Advanced] Update account-level variable. Returns Variable JSON with: name, value, id. Format as: ✅ Variable '{name}' updated to: {value} (ID: {id}).",
    )
}

pub fn update_account_variable_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: UpdateAccountVariableParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let variable_id: i32 = params.variable_id.parse()
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid variable_id: {}", e)))?;

            let request = datto_api::VariableUpdateRequest {
                name: params.name.clone(),
                value: params.value.clone(),
                ..Default::default()
            };
            let variable = client.update_account_variable(variable_id, &request).await
                .map_err(|e| crate::Error::Api(format!("Failed to update account variable: {}", e)))?;

            let data = serde_json::to_value(&variable)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present a clear confirmation that the account variable was successfully updated. Show the variable name, updated value (mask if sensitive), and variable ID for reference. Use a success indicator (green checkmark). Highlight what changed if both name and value were updated.",
                Some(vec!["success_confirmation", "updated_details", "sensitive_masking"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct DeleteAccountVariableParams {
    pub variable_id: String,
}

pub fn delete_account_variable_tool() -> Tool {
    tool_helpers::create_tool::<DeleteAccountVariableParams>(
        "delete-account-variable",
        "🔧 [Advanced] Delete account-level variable",
    )
}

pub fn delete_account_variable_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: DeleteAccountVariableParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let variable_id: i32 = params.variable_id.parse()
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid variable_id: {}", e)))?;

            client.delete_account_variable(variable_id).await
                .map_err(|e| crate::Error::Api(format!("Failed to delete account variable: {}", e)))?;

            let result_data = serde_json::json!({
                "variable_id": &params.variable_id,
                "action": "deleted",
                "scope": "account",
                "status": "success"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present a clear confirmation that the account variable was successfully deleted. Show the variable ID and use a success indicator (green checkmark). Keep it brief and confirm the deletion is permanent.",
                Some(vec!["success_confirmation", "deletion_complete"])
            ))
        })
    })
}

// Site variable operations
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct CreateSiteVariableParams {
    pub site_uid: String,
    pub name: String,
    pub value: String,
}

pub fn create_site_variable_tool() -> Tool {
    tool_helpers::create_tool::<CreateSiteVariableParams>(
        "create-site-variable",
        "🔧 [Advanced] Create site-level variable. Returns Variable JSON with: name, value, id. Format as: ✅ Site variable '{name}' created with value: {value} (ID: {id}).",
    )
}

pub fn create_site_variable_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: CreateSiteVariableParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let request = datto_api::VariableCreationRequest {
                name: Some(params.name.clone()),
                value: Some(params.value.clone()),
                ..Default::default()
            };
            let variable = client.create_site_variable(&params.site_uid, &request).await
                .map_err(|e| crate::Error::Api(format!("Failed to create site variable: {}", e)))?;

            let data = serde_json::to_value(&variable)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present a clear confirmation that the site variable was successfully created. Show the variable name prominently, display the value (mask if it appears sensitive), include the variable ID and site UID for reference. Use a success indicator (green checkmark).",
                Some(vec!["success_confirmation", "variable_details", "site_context", "sensitive_masking"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct UpdateSiteVariableParams {
    pub site_uid: String,
    pub variable_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

pub fn update_site_variable_tool() -> Tool {
    tool_helpers::create_tool::<UpdateSiteVariableParams>(
        "update-site-variable",
        "🔧 [Advanced] Update site-level variable. Returns Variable JSON with: name, value, id. Format as: ✅ Site variable '{name}' updated to: {value} (ID: {id}).",
    )
}

pub fn update_site_variable_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: UpdateSiteVariableParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let variable_id: i32 = params.variable_id.parse()
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid variable_id: {}", e)))?;

            let request = datto_api::VariableUpdateRequest {
                name: params.name.clone(),
                value: params.value.clone(),
                ..Default::default()
            };
            let variable = client.update_site_variable(&params.site_uid, variable_id, &request).await
                .map_err(|e| crate::Error::Api(format!("Failed to update site variable: {}", e)))?;

            let data = serde_json::to_value(&variable)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present a clear confirmation that the site variable was successfully updated. Show the variable name, updated value (mask if sensitive), variable ID, and site UID for context. Use a success indicator (green checkmark). Highlight what changed.",
                Some(vec!["success_confirmation", "updated_details", "site_context", "sensitive_masking"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct DeleteSiteVariableParams {
    pub site_uid: String,
    pub variable_id: String,
}

pub fn delete_site_variable_tool() -> Tool {
    tool_helpers::create_tool::<DeleteSiteVariableParams>(
        "delete-site-variable",
        "🔧 [Advanced] Delete site-level variable",
    )
}

pub fn delete_site_variable_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: DeleteSiteVariableParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let variable_id: i32 = params.variable_id.parse()
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid variable_id: {}", e)))?;

            client.delete_site_variable(&params.site_uid, variable_id).await
                .map_err(|e| crate::Error::Api(format!("Failed to delete site variable: {}", e)))?;

            let result_data = serde_json::json!({
                "variable_id": &params.variable_id,
                "site_uid": &params.site_uid,
                "action": "deleted",
                "scope": "site",
                "status": "success"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present a clear confirmation that the site variable was successfully deleted. Show the variable ID and site UID for context. Use a success indicator (green checkmark). Confirm the deletion is permanent.",
                Some(vec!["success_confirmation", "deletion_complete", "site_context"])
            ))
        })
    })
}

// Site proxy operations
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct UpdateSiteProxyParams {
    pub site_uid: String,
    pub host: String,
    pub port: i32,
}

pub fn update_site_proxy_tool() -> Tool {
    tool_helpers::create_tool::<UpdateSiteProxyParams>(
        "update-site-proxy",
        "🔧 [Advanced] Update site proxy settings",
    )
}

pub fn update_site_proxy_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: UpdateSiteProxyParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let proxy = datto_api::ProxySettings {
                host: Some(params.host.clone()),
                port: Some(params.port),
                ..Default::default()
            };
            client.update_site_proxy(&params.site_uid, &proxy).await
                .map_err(|e| crate::Error::Api(format!("Failed to update site proxy: {}", e)))?;

            let result_data = serde_json::json!({
                "site_uid": &params.site_uid,
                "proxy_host": &params.host,
                "proxy_port": params.port,
                "action": "updated",
                "status": "success"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present a clear confirmation that the site proxy settings were successfully updated. Show the proxy host and port prominently, include site UID for context. Use a success indicator (green checkmark). Format as 'Proxy updated to host:port'.",
                Some(vec!["success_confirmation", "proxy_details", "site_context"])
            ))
        })
    })
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct DeleteSiteProxyParams {
    pub site_uid: String,
}

pub fn delete_site_proxy_tool() -> Tool {
    tool_helpers::create_tool::<DeleteSiteProxyParams>(
        "delete-site-proxy",
        "🔧 [Advanced] Delete site proxy settings",
    )
}

pub fn delete_site_proxy_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: DeleteSiteProxyParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            client.delete_site_proxy(&params.site_uid).await
                .map_err(|e| crate::Error::Api(format!("Failed to delete site proxy: {}", e)))?;

            let result_data = serde_json::json!({
                "site_uid": &params.site_uid,
                "action": "deleted",
                "type": "proxy_settings",
                "status": "success"
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present a clear confirmation that the site proxy settings were successfully deleted. Show the site UID for context. Use a success indicator (green checkmark). Note that the site will now use direct connections or inherit account-level proxy settings.",
                Some(vec!["success_confirmation", "deletion_complete", "site_context"])
            ))
        })
    })
}
