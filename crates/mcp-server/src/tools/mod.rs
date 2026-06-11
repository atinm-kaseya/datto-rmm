pub mod tier1;
pub mod tier2;

use crate::{tool_context::ToolContext, Error, Result};
use datto_api::{DattoClient, McpCallHeaders};
use rmcp::model::{CallToolResult, Tool};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

/// Handler function for a tool — receives client, arguments, and MCP context headers.
pub type ToolHandler =
    Box<dyn Fn(Arc<DattoClient>, Value, McpCallHeaders) -> BoxFuture<'static, Result<CallToolResult>> + Send + Sync>;

type BoxFuture<'a, T> = std::pin::Pin<Box<dyn std::future::Future<Output = T> + Send + 'a>>;

/// Registry for all MCP tools (Tier 1 + Tier 2)
pub struct ToolRegistry {
    tools: HashMap<String, ToolDefinition>,
}

struct ToolDefinition {
    metadata: Tool,
    handler: ToolHandler,
}

impl ToolRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            tools: HashMap::new(),
        };

        // Register Tier 1 tools (task-oriented composite tools)
        registry.register_tier1_tools();

        // Register Tier 2 tools (API-level tools)
        registry.register_tier2_tools();

        registry
    }

    fn register_tier1_tools(&mut self) {
        // Account overview tools
        self.register(
            tier1::account::get_account_dashboard_tool(),
            tier1::account::get_account_dashboard_handler(),
        );
        self.register(
            tier1::account::find_sites_with_issues_tool(),
            tier1::account::find_sites_with_issues_handler(),
        );
        self.register(
            tier1::account::search_devices_tool(),
            tier1::account::search_devices_handler(),
        );
        self.register(
            tier1::account::get_account_analytics_tool(),
            tier1::account::get_account_analytics_handler(),
        );

        // Site operation tools
        self.register(
            tier1::site::get_site_health_tool(),
            tier1::site::get_site_health_handler(),
        );
        self.register(
            tier1::site::list_site_devices_tool(),
            tier1::site::list_site_devices_handler(),
        );
        self.register(
            tier1::site::get_site_alerts_tool(),
            tier1::site::get_site_alerts_handler(),
        );
        self.register(
            tier1::site::run_site_component_tool(),
            tier1::site::run_site_component_handler(),
        );
        self.register(
            tier1::site::bulk_update_site_devices_tool(),
            tier1::site::bulk_update_site_devices_handler(),
        );

        // Device operation tools
        self.register(
            tier1::device::get_device_health_tool(),
            tier1::device::get_device_health_handler(),
        );
        self.register(
            tier1::device::diagnose_device_issue_tool(),
            tier1::device::diagnose_device_issue_handler(),
        );

        // Alert management tools
        self.register(
            tier1::alert::get_alert_summary_tool(),
            tier1::alert::get_alert_summary_handler(),
        );
        self.register(
            tier1::alert::investigate_alert_tool(),
            tier1::alert::investigate_alert_handler(),
        );
    }

    fn register_tier2_tools(&mut self) {
        // Account tools
        self.register(tier2::account::get_account_tool(), tier2::account::get_account_handler());
        self.register(tier2::account::get_metering_summary_tool(), tier2::account::get_metering_summary_handler());
        self.register(tier2::account::list_sites_tool(), tier2::account::list_sites_handler());
        self.register(tier2::account::list_devices_tool(), tier2::account::list_devices_handler());
        self.register(tier2::account::list_open_alerts_tool(), tier2::account::list_open_alerts_handler());
        self.register(tier2::account::list_resolved_alerts_tool(), tier2::account::list_resolved_alerts_handler());
        self.register(tier2::account::list_components_tool(), tier2::account::list_components_handler());
        self.register(tier2::account::list_account_variables_tool(), tier2::account::list_account_variables_handler());
        self.register(tier2::account::list_users_tool(), tier2::account::list_users_handler());

        // Site tools
        self.register(tier2::site::get_site_tool(), tier2::site::get_site_handler());
        self.register(tier2::site::list_site_devices_tool(), tier2::site::list_site_devices_handler()); // Registered as 'get-site-devices'
        self.register(tier2::site::list_site_open_alerts_tool(), tier2::site::list_site_open_alerts_handler());
        self.register(tier2::site::list_site_resolved_alerts_tool(), tier2::site::list_site_resolved_alerts_handler());
        self.register(tier2::site::get_site_settings_tool(), tier2::site::get_site_settings_handler());
        self.register(tier2::site::list_site_variables_tool(), tier2::site::list_site_variables_handler());
        self.register(tier2::site::create_site_tool(), tier2::site::create_site_handler());
        self.register(tier2::site::update_site_tool(), tier2::site::update_site_handler());
        self.register(tier2::site::list_site_filters_tool(), tier2::site::list_site_filters_handler());

        // Device tools
        self.register(tier2::device::get_device_tool(), tier2::device::get_device_handler());
        self.register(tier2::device::get_device_by_id_tool(), tier2::device::get_device_by_id_handler());
        self.register(tier2::device::get_device_by_mac_tool(), tier2::device::get_device_by_mac_handler());
        self.register(tier2::device::list_device_open_alerts_tool(), tier2::device::list_device_open_alerts_handler());
        self.register(tier2::device::list_device_resolved_alerts_tool(), tier2::device::list_device_resolved_alerts_handler());
        self.register(tier2::device::move_device_tool(), tier2::device::move_device_handler());
        self.register(tier2::device::set_device_udf_tool(), tier2::device::set_device_udf_handler());
        self.register(tier2::device::set_device_warranty_tool(), tier2::device::set_device_warranty_handler());
        self.register(tier2::device::create_quick_job_tool(), tier2::device::create_quick_job_handler());

        // Alert tools
        self.register(tier2::alert::get_alert_tool(), tier2::alert::get_alert_handler());
        self.register(tier2::alert::resolve_alert_tool(), tier2::alert::resolve_alert_handler());

        // Job tools
        self.register(tier2::job::get_job_tool(), tier2::job::get_job_handler());
        self.register(tier2::job::get_job_results_tool(), tier2::job::get_job_results_handler());
        self.register(tier2::job::get_job_components_tool(), tier2::job::get_job_components_handler());
        self.register(tier2::job::get_job_stdout_tool(), tier2::job::get_job_stdout_handler());
        self.register(tier2::job::get_job_stderr_tool(), tier2::job::get_job_stderr_handler());

        // Audit tools
        self.register(tier2::audit::get_device_audit_tool(), tier2::audit::get_device_audit_handler());
        self.register(tier2::audit::get_device_software_tool(), tier2::audit::get_device_software_handler());
        self.register(tier2::audit::get_device_audit_by_mac_tool(), tier2::audit::get_device_audit_by_mac_handler());
        self.register(tier2::audit::get_esxi_audit_tool(), tier2::audit::get_esxi_audit_handler());
        self.register(tier2::audit::get_printer_audit_tool(), tier2::audit::get_printer_audit_handler());

        // Activity tools
        self.register(tier2::activity::get_activity_logs_tool(), tier2::activity::get_activity_logs_handler());

        // System & Filter tools
        self.register(tier2::system::get_system_status_tool(), tier2::system::get_system_status_handler());
        self.register(tier2::system::get_rate_limit_tool(), tier2::system::get_rate_limit_handler());
        self.register(tier2::system::get_pagination_config_tool(), tier2::system::get_pagination_config_handler());
        self.register(tier2::system::list_default_filters_tool(), tier2::system::list_default_filters_handler());
        self.register(tier2::system::list_custom_filters_tool(), tier2::system::list_custom_filters_handler());

        // Variable & Proxy tools
        self.register(tier2::variables::create_account_variable_tool(), tier2::variables::create_account_variable_handler());
        self.register(tier2::variables::update_account_variable_tool(), tier2::variables::update_account_variable_handler());
        self.register(tier2::variables::delete_account_variable_tool(), tier2::variables::delete_account_variable_handler());
        self.register(tier2::variables::create_site_variable_tool(), tier2::variables::create_site_variable_handler());
        self.register(tier2::variables::update_site_variable_tool(), tier2::variables::update_site_variable_handler());
        self.register(tier2::variables::delete_site_variable_tool(), tier2::variables::delete_site_variable_handler());
        self.register(tier2::variables::update_site_proxy_tool(), tier2::variables::update_site_proxy_handler());
        self.register(tier2::variables::delete_site_proxy_tool(), tier2::variables::delete_site_proxy_handler());
    }

    fn register(&mut self, metadata: Tool, handler: ToolHandler) {
        let name = metadata.name.to_string();
        self.tools.insert(name, ToolDefinition { metadata, handler });
    }

    pub fn list_tools(&self) -> Vec<Tool> {
        self.tools.values().map(|def| def.metadata.clone()).collect()
    }

    pub async fn call_tool(
        &self,
        name: &str,
        arguments: &Option<Value>,
        client: Arc<DattoClient>,
        context: ToolContext,
        agent_id: &str,
    ) -> Result<CallToolResult> {
        let tool = self
            .tools
            .get(name)
            .ok_or_else(|| Error::NotFound(format!("Tool '{}' not found", name)))?;

        let args = arguments.clone().unwrap_or(Value::Object(Default::default()));
        let mcp_headers = context.to_mcp_headers(agent_id);

        (tool.handler)(client, args, mcp_headers).await
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}
