//! Typed API methods for Datto RMM.
//!
//! These methods provide a high-level interface to the Datto RMM API,
//! using the auto-generated types from the OpenAPI spec.

use crate::{mcp_headers::McpCallHeaders, DattoClient, Error};

#[cfg(has_generated_api)]
use crate::generated::*;

/// Query parameters for pagination.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PaginationQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<i32>,
}

impl Default for PaginationQuery {
    fn default() -> Self {
        Self {
            page: Some(1),
            max: Some(100),
        }
    }
}

#[cfg(has_generated_api)]
impl DattoClient {
    // =====================================================================
    // Account API
    // =====================================================================

    /// Get account information.
    ///
    /// GET /v2/account
    pub async fn get_account(&self) -> Result<Account, Error> {
        self.get("/v2/account").await
    }

    /// List all sites in the account.
    ///
    /// GET /v2/account/sites
    pub async fn list_sites(&self, query: Option<PaginationQuery>) -> Result<SitesPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/account/sites", &query).await
    }

    /// List all devices in the account.
    ///
    /// GET /v2/account/devices
    pub async fn list_devices(&self, query: Option<PaginationQuery>) -> Result<DevicesPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/account/devices", &query).await
    }

    /// List open alerts for the account.
    ///
    /// GET /v2/account/alerts/open
    pub async fn list_open_alerts(&self, query: Option<PaginationQuery>) -> Result<AlertsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/account/alerts/open", &query).await
    }

    /// List resolved alerts for the account.
    ///
    /// GET /v2/account/alerts/resolved
    pub async fn list_resolved_alerts(&self, query: Option<PaginationQuery>) -> Result<AlertsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/account/alerts/resolved", &query).await
    }

    /// List available components.
    ///
    /// GET /v2/account/components
    pub async fn list_components(&self, query: Option<PaginationQuery>) -> Result<ComponentsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/account/components", &query).await
    }

    // =====================================================================
    // Site API
    // =====================================================================

    /// Get site information by UID.
    ///
    /// GET /v2/site/{siteUid}
    pub async fn get_site(&self, site_uid: &str) -> Result<Site, Error> {
        let path = format!("/v2/site/{}", site_uid);
        self.get(&path).await
    }

    /// List devices for a site.
    ///
    /// GET /v2/site/{siteUid}/devices
    pub async fn list_site_devices(
        &self,
        site_uid: &str,
        query: Option<PaginationQuery>,
    ) -> Result<DevicesPage, Error> {
        let path = format!("/v2/site/{}/devices", site_uid);
        let query = query.unwrap_or_default();
        self.get_with_query(&path, &query).await
    }

    /// List open alerts for a site.
    ///
    /// GET /v2/site/{siteUid}/alerts/open
    pub async fn list_site_open_alerts(
        &self,
        site_uid: &str,
        query: Option<PaginationQuery>,
    ) -> Result<AlertsPage, Error> {
        let path = format!("/v2/site/{}/alerts/open", site_uid);
        let query = query.unwrap_or_default();
        self.get_with_query(&path, &query).await
    }

    /// Get site settings.
    ///
    /// GET /v2/site/{siteUid}/settings
    pub async fn get_site_settings(&self, site_uid: &str) -> Result<SiteSettings, Error> {
        let path = format!("/v2/site/{}/settings", site_uid);
        self.get(&path).await
    }

    /// List site variables.
    ///
    /// GET /v2/site/{siteUid}/variables
    pub async fn list_site_variables(
        &self,
        site_uid: &str,
        query: Option<PaginationQuery>,
    ) -> Result<VariablesPage, Error> {
        let path = format!("/v2/site/{}/variables", site_uid);
        let query = query.unwrap_or_default();
        self.get_with_query(&path, &query).await
    }

    // =====================================================================
    // Device API
    // =====================================================================

    /// Get device information by UID.
    ///
    /// GET /v2/device/{deviceUid}
    pub async fn get_device(&self, device_uid: &str) -> Result<Device, Error> {
        let path = format!("/v2/device/{}", device_uid);
        self.get(&path).await
    }

    /// List open alerts for a device.
    ///
    /// GET /v2/device/{deviceUid}/alerts/open
    pub async fn list_device_open_alerts(
        &self,
        device_uid: &str,
        query: Option<PaginationQuery>,
    ) -> Result<AlertsPage, Error> {
        let path = format!("/v2/device/{}/alerts/open", device_uid);
        let query = query.unwrap_or_default();
        self.get_with_query(&path, &query).await
    }

    // =====================================================================
    // Alert API
    // =====================================================================

    /// Get alert information by UID.
    ///
    /// GET /v2/alert/{alertUid}
    pub async fn get_alert(&self, alert_uid: &str) -> Result<Alert, Error> {
        let path = format!("/v2/alert/{}", alert_uid);
        self.get(&path).await
    }

    /// Get alert context data.
    ///
    /// GET /v2/alert/{alertUid}/context
    pub async fn get_alert_context(&self, alert_uid: &str) -> Result<AlertContext, Error> {
        let path = format!("/v2/alert/{}/context", alert_uid);
        self.get(&path).await
    }

    /// Resolve an alert.
    ///
    /// POST /v2/alert/{alertUid}/resolve
    pub async fn resolve_alert(&self, alert_uid: &str) -> Result<(), Error> {
        let path = format!("/v2/alert/{}/resolve", alert_uid);
        // Using a unit type for void responses
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.post(&path, &serde_json::json!({})).await;
        Ok(())
    }

    // =====================================================================
    // Job API
    // =====================================================================

    /// Get job information by UID.
    ///
    /// GET /v2/job/{jobUid}
    pub async fn get_job(&self, job_uid: &str) -> Result<Job, Error> {
        let path = format!("/v2/job/{}", job_uid);
        self.get(&path).await
    }

    /// Get job results.
    ///
    /// GET /v2/job/{jobUid}/results
    pub async fn get_job_results(&self, job_uid: &str) -> Result<JobResults, Error> {
        let path = format!("/v2/job/{}/results", job_uid);
        self.get(&path).await
    }

    // =====================================================================
    // Audit API
    // =====================================================================

    /// Get device audit information.
    ///
    /// GET /v2/audit/device/{deviceUid}
    pub async fn get_device_audit(&self, device_uid: &str) -> Result<DeviceAudit, Error> {
        let path = format!("/v2/audit/device/{}", device_uid);
        self.get(&path).await
    }

    /// Get installed software for a device.
    ///
    /// GET /v2/audit/software/device/{deviceUid}
    pub async fn get_device_software(
        &self,
        device_uid: &str,
        query: Option<PaginationQuery>,
    ) -> Result<SoftwarePage, Error> {
        let path = format!("/v2/audit/software/device/{}", device_uid);
        let query = query.unwrap_or_default();
        self.get_with_query(&path, &query).await
    }

    // =====================================================================
    // Activity Logs API  
    // =====================================================================

    /// List activity logs.
    ///
    /// GET /v2/activity-logs
    pub async fn list_activity_logs(&self, query: Option<PaginationQuery>) -> Result<ActivityLogsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/activity-logs", &query).await
    }

    // =====================================================================
    // Additional Account API
    // =====================================================================

    /// List account variables.
    ///
    /// GET /v2/account/variables
    pub async fn list_account_variables(&self, query: Option<PaginationQuery>) -> Result<VariablesPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/account/variables", &query).await
    }

    /// List users in the account.
    ///
    /// GET /v2/account/users
    pub async fn list_users(&self, query: Option<PaginationQuery>) -> Result<UsersPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/account/users", &query).await
    }

    // =====================================================================
    // Additional Site API
    // =====================================================================

    /// List resolved alerts for a site.
    ///
    /// GET /v2/site/{siteUid}/alerts/resolved
    pub async fn list_site_resolved_alerts(
        &self,
        site_uid: &str,
        query: Option<PaginationQuery>,
    ) -> Result<AlertsPage, Error> {
        let path = format!("/v2/site/{}/alerts/resolved", site_uid);
        let query = query.unwrap_or_default();
        self.get_with_query(&path, &query).await
    }

    // =====================================================================
    // Additional Device API
    // =====================================================================

    /// Get device by numeric ID.
    ///
    /// GET /v2/device/id/{deviceId}
    pub async fn get_device_by_id(&self, device_id: i64) -> Result<Device, Error> {
        let path = format!("/v2/device/id/{}", device_id);
        self.get(&path).await
    }

    /// Get device by MAC address.
    ///
    /// GET /v2/device/macAddress/{macAddress}
    pub async fn get_device_by_mac(&self, mac_address: &str) -> Result<Device, Error> {
        let path = format!("/v2/device/macAddress/{}", mac_address);
        self.get(&path).await
    }

    /// List resolved alerts for a device.
    ///
    /// GET /v2/device/{deviceUid}/alerts/resolved
    pub async fn list_device_resolved_alerts(
        &self,
        device_uid: &str,
        query: Option<PaginationQuery>,
    ) -> Result<AlertsPage, Error> {
        let path = format!("/v2/device/{}/alerts/resolved", device_uid);
        let query = query.unwrap_or_default();
        self.get_with_query(&path, &query).await
    }

    // =====================================================================
    // Additional Job API
    // =====================================================================

    /// Get job components that were executed.
    ///
    /// GET /v2/job/{jobUid}/components
    pub async fn get_job_components(&self, job_uid: &str) -> Result<JobComponentsPage, Error> {
        let path = format!("/v2/job/{}/components", job_uid);
        self.get(&path).await
    }

    /// Get stdout for a specific device in a job.
    ///
    /// GET /v2/job/{jobUid}/results/{deviceUid}/stdout
    pub async fn get_job_stdout(&self, job_uid: &str, device_uid: &str) -> Result<String, Error> {
        let path = format!("/v2/job/{}/results/{}/stdout", job_uid, device_uid);
        self.get(&path).await
    }

    /// Get stderr for a specific device in a job.
    ///
    /// GET /v2/job/{jobUid}/results/{deviceUid}/stderr
    pub async fn get_job_stderr(&self, job_uid: &str, device_uid: &str) -> Result<String, Error> {
        let path = format!("/v2/job/{}/results/{}/stderr", job_uid, device_uid);
        self.get(&path).await
    }

    // =====================================================================
    // Additional Audit API
    // =====================================================================

    /// Get device audit by MAC address.
    ///
    /// GET /v2/audit/device/macAddress/{macAddress}
    pub async fn get_device_audit_by_mac(&self, mac_address: &str) -> Result<DeviceAudit, Error> {
        let path = format!("/v2/audit/device/macAddress/{}", mac_address);
        self.get(&path).await
    }

    /// Get ESXi host audit.
    ///
    /// GET /v2/audit/esxi/{deviceUid}
    pub async fn get_esxi_audit(&self, device_uid: &str) -> Result<EsxiHostAudit, Error> {
        let path = format!("/v2/audit/esxi/{}", device_uid);
        self.get(&path).await
    }

    /// Get printer audit.
    ///
    /// GET /v2/audit/printer/{deviceUid}
    pub async fn get_printer_audit(&self, device_uid: &str) -> Result<PrinterAudit, Error> {
        let path = format!("/v2/audit/printer/{}", device_uid);
        self.get(&path).await
    }

    // =====================================================================
    // System API
    // =====================================================================

    /// Get system status.
    ///
    /// GET /v2/system/status
    pub async fn get_system_status(&self) -> Result<StatusResponse, Error> {
        self.get("/v2/system/status").await
    }

    /// Get rate limit information.
    ///
    /// GET /v2/system/request_rate
    pub async fn get_rate_limit_info(&self) -> Result<RateStatusResponse, Error> {
        self.get("/v2/system/request_rate").await
    }

    /// Get pagination configuration.
    ///
    /// GET /v2/system/pagination
    pub async fn get_pagination_config(&self) -> Result<PaginationConfiguration, Error> {
        self.get("/v2/system/pagination").await
    }

    /// Get default filters.
    ///
    /// GET /v2/filter/default
    pub async fn list_default_filters(&self, query: Option<PaginationQuery>) -> Result<FiltersPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/filter/default", &query).await
    }

    /// Get custom filters.
    ///
    /// GET /v2/filter/custom
    pub async fn list_custom_filters(&self, query: Option<PaginationQuery>) -> Result<FiltersPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query("/v2/filter/custom", &query).await
    }

    /// Get site filters.
    ///
    /// GET /v2/site/{siteUid}/filters
    pub async fn list_site_filters(
        &self,
        site_uid: &str,
        query: Option<PaginationQuery>,
    ) -> Result<FiltersPage, Error> {
        let path = format!("/v2/site/{}/filters", site_uid);
        let query = query.unwrap_or_default();
        self.get_with_query(&path, &query).await
    }

    // =====================================================================
    // Write Operations (Site)
    // =====================================================================

    /// Create a new site.
    ///
    /// PUT /v2/site
    pub async fn create_site(&self, request: &CreateSiteRequest) -> Result<Site, Error> {
        self.put("/v2/site", request).await
    }

    /// Update a site.
    ///
    /// POST /v2/site/{siteUid}
    pub async fn update_site(&self, site_uid: &str, site: &Site) -> Result<Site, Error> {
        let path = format!("/v2/site/{}", site_uid);
        self.post(&path, site).await
    }

    // =====================================================================
    // Write Operations (Device)
    // =====================================================================

    /// Move device to a different site.
    ///
    /// POST /v2/device/{deviceUid}/site/{siteUid}
    pub async fn move_device(&self, device_uid: &str, site_uid: &str) -> Result<(), Error> {
        let path = format!("/v2/device/{}/site/{}", device_uid, site_uid);
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.post(&path, &serde_json::json!({})).await;
        Ok(())
    }

    /// Set device user-defined fields.
    ///
    /// PUT /v2/device/{deviceUid}/udf
    pub async fn set_device_udf(&self, device_uid: &str, udf: &Udf) -> Result<(), Error> {
        let path = format!("/v2/device/{}/udf", device_uid);
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.put(&path, udf).await;
        Ok(())
    }

    /// Set device warranty date.
    ///
    /// PUT /v2/device/{deviceUid}/warranty
    pub async fn set_device_warranty(&self, device_uid: &str, warranty: &Warranty) -> Result<(), Error> {
        let path = format!("/v2/device/{}/warranty", device_uid);
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.put(&path, warranty).await;
        Ok(())
    }

    /// Create a quick job on a device.
    ///
    /// PUT /v2/device/{deviceUid}/quickjob
    pub async fn create_quick_job(&self, device_uid: &str, request: &CreateQuickJobRequest) -> Result<CreateQuickJobResponse, Error> {
        let path = format!("/v2/device/{}/quickjob", device_uid);
        self.put(&path, request).await
    }

    // =====================================================================
    // Write Operations (Variables)
    // =====================================================================

    /// Create account variable.
    ///
    /// PUT /v2/account/variable
    pub async fn create_account_variable(&self, request: &VariableCreationRequest) -> Result<Variable, Error> {
        self.put("/v2/account/variable", request).await
    }

    /// Update account variable.
    ///
    /// POST /v2/account/variable/{variableId}
    pub async fn update_account_variable(&self, variable_id: i32, request: &VariableUpdateRequest) -> Result<Variable, Error> {
        let path = format!("/v2/account/variable/{}", variable_id);
        self.post(&path, request).await
    }

    /// Delete account variable.
    ///
    /// DELETE /v2/account/variable/{variableId}
    pub async fn delete_account_variable(&self, variable_id: i32) -> Result<(), Error> {
        let path = format!("/v2/account/variable/{}", variable_id);
        self.delete(&path).await
    }

    /// Create site variable.
    ///
    /// PUT /v2/site/{siteUid}/variable
    pub async fn create_site_variable(&self, site_uid: &str, request: &VariableCreationRequest) -> Result<Variable, Error> {
        let path = format!("/v2/site/{}/variable", site_uid);
        self.put(&path, request).await
    }

    /// Update site variable.
    ///
    /// POST /v2/site/{siteUid}/variable/{variableId}
    pub async fn update_site_variable(&self, site_uid: &str, variable_id: i32, request: &VariableUpdateRequest) -> Result<Variable, Error> {
        let path = format!("/v2/site/{}/variable/{}", site_uid, variable_id);
        self.post(&path, request).await
    }

    /// Delete site variable.
    ///
    /// DELETE /v2/site/{siteUid}/variable/{variableId}
    pub async fn delete_site_variable(&self, site_uid: &str, variable_id: i32) -> Result<(), Error> {
        let path = format!("/v2/site/{}/variable/{}", site_uid, variable_id);
        self.delete(&path).await
    }

    /// Update site proxy settings.
    ///
    /// POST /v2/site/{siteUid}/settings/proxy
    pub async fn update_site_proxy(&self, site_uid: &str, proxy: &ProxySettings) -> Result<(), Error> {
        let path = format!("/v2/site/{}/settings/proxy", site_uid);
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.post(&path, proxy).await;
        Ok(())
    }

    /// Delete site proxy settings.
    ///
    /// DELETE /v2/site/{siteUid}/settings/proxy
    pub async fn delete_site_proxy(&self, site_uid: &str) -> Result<(), Error> {
        let path = format!("/v2/site/{}/settings/proxy", site_uid);
        self.delete(&path).await
    }
}

/// MCP-aware business methods — identical to the base methods but forward MCP context headers.
#[cfg(has_generated_api)]
impl DattoClient {
    // Account API
    pub async fn get_account_with_mcp(&self, mcp: &McpCallHeaders) -> Result<Account, Error> {
        self.get_with_mcp("/v2/account", mcp).await
    }
    pub async fn list_sites_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<SitesPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/account/sites", &query, mcp).await
    }
    pub async fn list_devices_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<DevicesPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/account/devices", &query, mcp).await
    }
    pub async fn list_open_alerts_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<AlertsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/account/alerts/open", &query, mcp).await
    }
    pub async fn list_resolved_alerts_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<AlertsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/account/alerts/resolved", &query, mcp).await
    }
    pub async fn list_components_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<ComponentsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/account/components", &query, mcp).await
    }
    pub async fn list_account_variables_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<VariablesPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/account/variables", &query, mcp).await
    }
    pub async fn list_users_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<UsersPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/account/users", &query, mcp).await
    }

    // Site API
    pub async fn get_site_with_mcp(&self, site_uid: &str, mcp: &McpCallHeaders) -> Result<Site, Error> {
        self.get_with_mcp(&format!("/v2/site/{}", site_uid), mcp).await
    }
    pub async fn list_site_devices_with_mcp(&self, site_uid: &str, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<DevicesPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp(&format!("/v2/site/{}/devices", site_uid), &query, mcp).await
    }
    pub async fn list_site_open_alerts_with_mcp(&self, site_uid: &str, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<AlertsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp(&format!("/v2/site/{}/alerts/open", site_uid), &query, mcp).await
    }
    pub async fn list_site_resolved_alerts_with_mcp(&self, site_uid: &str, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<AlertsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp(&format!("/v2/site/{}/alerts/resolved", site_uid), &query, mcp).await
    }
    pub async fn get_site_settings_with_mcp(&self, site_uid: &str, mcp: &McpCallHeaders) -> Result<SiteSettings, Error> {
        self.get_with_mcp(&format!("/v2/site/{}/settings", site_uid), mcp).await
    }
    pub async fn list_site_variables_with_mcp(&self, site_uid: &str, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<VariablesPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp(&format!("/v2/site/{}/variables", site_uid), &query, mcp).await
    }
    pub async fn list_site_filters_with_mcp(&self, site_uid: &str, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<FiltersPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp(&format!("/v2/site/{}/filters", site_uid), &query, mcp).await
    }
    pub async fn create_site_with_mcp(&self, request: &CreateSiteRequest, mcp: &McpCallHeaders) -> Result<Site, Error> {
        self.put_with_mcp("/v2/site", request, mcp).await
    }
    pub async fn update_site_with_mcp(&self, site_uid: &str, site: &Site, mcp: &McpCallHeaders) -> Result<Site, Error> {
        self.post_with_mcp(&format!("/v2/site/{}", site_uid), site, mcp).await
    }

    // Device API
    pub async fn get_device_with_mcp(&self, device_uid: &str, mcp: &McpCallHeaders) -> Result<Device, Error> {
        self.get_with_mcp(&format!("/v2/device/{}", device_uid), mcp).await
    }
    pub async fn get_device_by_id_with_mcp(&self, device_id: i64, mcp: &McpCallHeaders) -> Result<Device, Error> {
        self.get_with_mcp(&format!("/v2/device/id/{}", device_id), mcp).await
    }
    pub async fn get_device_by_mac_with_mcp(&self, mac_address: &str, mcp: &McpCallHeaders) -> Result<Device, Error> {
        self.get_with_mcp(&format!("/v2/device/macAddress/{}", mac_address), mcp).await
    }
    pub async fn list_device_open_alerts_with_mcp(&self, device_uid: &str, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<AlertsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp(&format!("/v2/device/{}/alerts/open", device_uid), &query, mcp).await
    }
    pub async fn list_device_resolved_alerts_with_mcp(&self, device_uid: &str, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<AlertsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp(&format!("/v2/device/{}/alerts/resolved", device_uid), &query, mcp).await
    }
    pub async fn move_device_with_mcp(&self, device_uid: &str, site_uid: &str, mcp: &McpCallHeaders) -> Result<(), Error> {
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.post_with_mcp(&format!("/v2/device/{}/site/{}", device_uid, site_uid), &serde_json::json!({}), mcp).await;
        Ok(())
    }
    pub async fn set_device_udf_with_mcp(&self, device_uid: &str, udf: &Udf, mcp: &McpCallHeaders) -> Result<(), Error> {
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.put_with_mcp(&format!("/v2/device/{}/udf", device_uid), udf, mcp).await;
        Ok(())
    }
    pub async fn set_device_warranty_with_mcp(&self, device_uid: &str, warranty: &Warranty, mcp: &McpCallHeaders) -> Result<(), Error> {
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.put_with_mcp(&format!("/v2/device/{}/warranty", device_uid), warranty, mcp).await;
        Ok(())
    }
    pub async fn create_quick_job_with_mcp(&self, device_uid: &str, request: &CreateQuickJobRequest, mcp: &McpCallHeaders) -> Result<CreateQuickJobResponse, Error> {
        self.put_with_mcp(&format!("/v2/device/{}/quickjob", device_uid), request, mcp).await
    }

    // Alert API
    pub async fn get_alert_with_mcp(&self, alert_uid: &str, mcp: &McpCallHeaders) -> Result<Alert, Error> {
        self.get_with_mcp(&format!("/v2/alert/{}", alert_uid), mcp).await
    }
    pub async fn get_alert_context_with_mcp(&self, alert_uid: &str, mcp: &McpCallHeaders) -> Result<AlertContext, Error> {
        self.get_with_mcp(&format!("/v2/alert/{}/context", alert_uid), mcp).await
    }
    pub async fn resolve_alert_with_mcp(&self, alert_uid: &str, mcp: &McpCallHeaders) -> Result<(), Error> {
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.post_with_mcp(&format!("/v2/alert/{}/resolve", alert_uid), &serde_json::json!({}), mcp).await;
        Ok(())
    }

    // Job API
    pub async fn get_job_with_mcp(&self, job_uid: &str, mcp: &McpCallHeaders) -> Result<Job, Error> {
        self.get_with_mcp(&format!("/v2/job/{}", job_uid), mcp).await
    }
    pub async fn get_job_results_with_mcp(&self, job_uid: &str, mcp: &McpCallHeaders) -> Result<JobResults, Error> {
        self.get_with_mcp(&format!("/v2/job/{}/results", job_uid), mcp).await
    }
    pub async fn get_job_components_with_mcp(&self, job_uid: &str, mcp: &McpCallHeaders) -> Result<JobComponentsPage, Error> {
        self.get_with_mcp(&format!("/v2/job/{}/components", job_uid), mcp).await
    }
    pub async fn get_job_stdout_with_mcp(&self, job_uid: &str, device_uid: &str, mcp: &McpCallHeaders) -> Result<String, Error> {
        self.get_with_mcp(&format!("/v2/job/{}/results/{}/stdout", job_uid, device_uid), mcp).await
    }
    pub async fn get_job_stderr_with_mcp(&self, job_uid: &str, device_uid: &str, mcp: &McpCallHeaders) -> Result<String, Error> {
        self.get_with_mcp(&format!("/v2/job/{}/results/{}/stderr", job_uid, device_uid), mcp).await
    }

    // Audit API
    pub async fn get_device_audit_with_mcp(&self, device_uid: &str, mcp: &McpCallHeaders) -> Result<DeviceAudit, Error> {
        self.get_with_mcp(&format!("/v2/audit/device/{}", device_uid), mcp).await
    }
    pub async fn get_device_software_with_mcp(&self, device_uid: &str, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<SoftwarePage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp(&format!("/v2/audit/software/device/{}", device_uid), &query, mcp).await
    }
    pub async fn get_device_audit_by_mac_with_mcp(&self, mac_address: &str, mcp: &McpCallHeaders) -> Result<DeviceAudit, Error> {
        self.get_with_mcp(&format!("/v2/audit/device/macAddress/{}", mac_address), mcp).await
    }
    pub async fn get_esxi_audit_with_mcp(&self, device_uid: &str, mcp: &McpCallHeaders) -> Result<EsxiHostAudit, Error> {
        self.get_with_mcp(&format!("/v2/audit/esxi/{}", device_uid), mcp).await
    }
    pub async fn get_printer_audit_with_mcp(&self, device_uid: &str, mcp: &McpCallHeaders) -> Result<PrinterAudit, Error> {
        self.get_with_mcp(&format!("/v2/audit/printer/{}", device_uid), mcp).await
    }

    // Activity Logs API
    pub async fn list_activity_logs_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<ActivityLogsPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/activity-logs", &query, mcp).await
    }

    // System API
    pub async fn get_system_status_with_mcp(&self, mcp: &McpCallHeaders) -> Result<StatusResponse, Error> {
        self.get_with_mcp("/v2/system/status", mcp).await
    }
    pub async fn get_rate_limit_info_with_mcp(&self, mcp: &McpCallHeaders) -> Result<RateStatusResponse, Error> {
        self.get_with_mcp("/v2/system/request_rate", mcp).await
    }
    pub async fn get_pagination_config_with_mcp(&self, mcp: &McpCallHeaders) -> Result<PaginationConfiguration, Error> {
        self.get_with_mcp("/v2/system/pagination", mcp).await
    }
    pub async fn list_default_filters_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<FiltersPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/filter/default", &query, mcp).await
    }
    pub async fn list_custom_filters_with_mcp(&self, query: Option<PaginationQuery>, mcp: &McpCallHeaders) -> Result<FiltersPage, Error> {
        let query = query.unwrap_or_default();
        self.get_with_query_with_mcp("/v2/filter/custom", &query, mcp).await
    }

    // Variables & Proxy API
    pub async fn create_account_variable_with_mcp(&self, request: &VariableCreationRequest, mcp: &McpCallHeaders) -> Result<Variable, Error> {
        self.put_with_mcp("/v2/account/variable", request, mcp).await
    }
    pub async fn update_account_variable_with_mcp(&self, variable_id: i32, request: &VariableUpdateRequest, mcp: &McpCallHeaders) -> Result<Variable, Error> {
        self.post_with_mcp(&format!("/v2/account/variable/{}", variable_id), request, mcp).await
    }
    pub async fn delete_account_variable_with_mcp(&self, variable_id: i32, mcp: &McpCallHeaders) -> Result<(), Error> {
        self.delete_with_mcp(&format!("/v2/account/variable/{}", variable_id), mcp).await
    }
    pub async fn create_site_variable_with_mcp(&self, site_uid: &str, request: &VariableCreationRequest, mcp: &McpCallHeaders) -> Result<Variable, Error> {
        self.put_with_mcp(&format!("/v2/site/{}/variable", site_uid), request, mcp).await
    }
    pub async fn update_site_variable_with_mcp(&self, site_uid: &str, variable_id: i32, request: &VariableUpdateRequest, mcp: &McpCallHeaders) -> Result<Variable, Error> {
        self.post_with_mcp(&format!("/v2/site/{}/variable/{}", site_uid, variable_id), request, mcp).await
    }
    pub async fn delete_site_variable_with_mcp(&self, site_uid: &str, variable_id: i32, mcp: &McpCallHeaders) -> Result<(), Error> {
        self.delete_with_mcp(&format!("/v2/site/{}/variable/{}", site_uid, variable_id), mcp).await
    }
    pub async fn update_site_proxy_with_mcp(&self, site_uid: &str, proxy: &ProxySettings, mcp: &McpCallHeaders) -> Result<(), Error> {
        #[derive(serde::Deserialize)]
        struct EmptyResponse {}
        let _: Result<EmptyResponse, _> = self.post_with_mcp(&format!("/v2/site/{}/settings/proxy", site_uid), proxy, mcp).await;
        Ok(())
    }
    pub async fn delete_site_proxy_with_mcp(&self, site_uid: &str, mcp: &McpCallHeaders) -> Result<(), Error> {
        self.delete_with_mcp(&format!("/v2/site/{}/settings/proxy", site_uid), mcp).await
    }

    // =====================================================================
    // Metering API
    // =====================================================================

    /// Get API call metering summary for the authenticated account.
    ///
    /// GET /v2/metering/summary?origin=<origin>
    pub async fn get_metering_summary_with_mcp(
        &self,
        origin: Option<&str>,
        mcp: &McpCallHeaders,
    ) -> Result<serde_json::Value, Error> {
        #[derive(serde::Serialize)]
        struct MeteringQuery<'a> {
            #[serde(skip_serializing_if = "Option::is_none")]
            origin: Option<&'a str>,
        }
        self.get_with_query_with_mcp("/v2/metering/summary", &MeteringQuery { origin }, mcp).await
    }
}

// If generated API is not available, provide stub implementations
#[cfg(not(has_generated_api))]
impl DattoClient {
    /// API methods are not available because the OpenAPI spec was not found during build.
    ///
    /// Run `pnpm sync:openapi` and rebuild to generate API types.
    pub async fn get_account(&self) -> Result<(), Error> {
        Err(Error::Api {
            status: 500,
            message: "API types not generated. Run 'pnpm sync:openapi' and rebuild.".to_string(),
        })
    }
}
