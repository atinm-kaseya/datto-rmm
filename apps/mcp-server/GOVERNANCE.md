# MCP Server Governance

Safety classifications and agent policies for all Datto RMM MCP tools.

## Classification Definitions

| Class | Description | Agent Policy |
|-------|-------------|--------------|
| **READ** | Retrieves data; no side effects | Always safe to call automatically |
| **WRITE** | Creates a new record | Show preview and confirm before calling |
| **UPDATE** | Modifies an existing record | Show diff and confirm; apply only patched fields |
| **DESTRUCTIVE** | Deletes or irreversibly changes state | Require explicit approval; display impact; log action |

---

## Tier 1 — Composite Tools

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_get_account_dashboard` | READ | Aggregates account-wide status |
| `rmm_find_sites_with_issues` | READ | Ranks sites by issue score |
| `rmm_search_devices` | READ | Cross-account device search |
| `rmm_get_site_health` | READ | Site health roll-up |
| `rmm_get_device_health` | READ | Device health roll-up |
| `rmm_diagnose_device_issue` | READ | Heuristic diagnostics; no writes |
| `rmm_investigate_alert` | READ | Alert context aggregation |
| `rmm_get_alert_summary` | READ | Alert count breakdown |
| `rmm_list_site_devices` | READ | Sorted device list for a site |
| `rmm_get_site_alerts` | READ | Grouped site alerts |
| `rmm_run_site_component` | WRITE | Dispatches jobs to devices; dry-run default |
| `rmm_bulk_update_site_devices` | UPDATE | Patches up to 50 devices; dry-run default |
| `rmm_get_account_analytics` | READ | Time-ranged account metrics |

## Tier 2 — Account

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_get_account` | READ | Account info |
| `rmm_list_sites` | READ | Paginated site list |
| `rmm_list_devices` | READ | Paginated device list |
| `rmm_list_users` | READ | Paginated user list |
| `rmm_list_account_variables` | READ | Account-level variables |
| `rmm_list_components` | READ | Available automation components |
| `rmm_list_open_alerts` | READ | Open alerts account-wide |
| `rmm_list_resolved_alerts` | READ | Resolved alerts account-wide |
| `rmm_get_api_metering_summary` | READ | API call usage stats |

## Tier 2 — Sites

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_get_site` | READ | Single site details |
| `rmm_get_site_devices` | READ | Devices for a site |
| `rmm_list_site_open_alerts` | READ | Open alerts for a site |
| `rmm_list_site_resolved_alerts` | READ | Resolved alerts for a site |
| `rmm_list_site_variables` | READ | Variables for a site |
| `rmm_get_site_settings` | READ | Site proxy/settings |
| `rmm_list_site_filters` | READ | Filters for a site |
| `rmm_create_site` | WRITE | Creates a new site; confirm name before calling |
| `rmm_update_site` | UPDATE | Renames or reconfigures a site |
| `rmm_update_site_proxy` | UPDATE | Updates site proxy settings |
| `rmm_delete_site_proxy` | DESTRUCTIVE | Removes site proxy configuration |

## Tier 2 — Devices

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_get_device` | READ | Device by UID |
| `rmm_get_device_by_id` | READ | Device by numeric ID |
| `rmm_get_device_by_mac` | READ | Device by MAC address |
| `rmm_list_device_open_alerts` | READ | Open alerts for a device |
| `rmm_list_device_resolved_alerts` | READ | Resolved alerts for a device |
| `rmm_move_device` | UPDATE | Moves device to a different site |
| `rmm_create_quick_job` | WRITE | Runs a component on a device; confirm before calling |
| `rmm_set_device_udf` | UPDATE | Updates user-defined fields on a device |
| `rmm_set_device_warranty` | UPDATE | Updates warranty date on a device |

## Tier 2 — Alerts

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_get_alert` | READ | Single alert details |
| `rmm_resolve_alert` | DESTRUCTIVE | Resolves (closes) an alert; irreversible |

## Tier 2 — Jobs

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_get_job` | READ | Job status |
| `rmm_get_job_components` | READ | Components included in a job |
| `rmm_get_job_results` | READ | Per-device job results |
| `rmm_get_job_stdout` | READ | Job stdout output |
| `rmm_get_job_stderr` | READ | Job stderr output |

## Tier 2 — Audit

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_get_device_audit` | READ | Hardware/software audit for a device |
| `rmm_get_device_software` | READ | Installed software list |
| `rmm_get_device_audit_by_mac` | READ | Audit lookup by MAC address |
| `rmm_get_esxi_audit` | READ | ESXi host audit |
| `rmm_get_printer_audit` | READ | Printer audit |

## Tier 2 — Activity

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_get_activity_logs` | READ | Account activity log |

## Tier 2 — Filters

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_list_default_filters` | READ | Built-in device filters |
| `rmm_list_custom_filters` | READ | User-defined device filters |

## Tier 2 — System

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_get_system_status` | READ | API health/status |
| `rmm_get_rate_limit` | READ | Current rate limit state |
| `rmm_get_pagination_config` | READ | Pagination defaults |

## Tier 2 — Variables

| Tool | Class | Notes |
|------|-------|-------|
| `rmm_create_account_variable` | WRITE | Creates account-level variable; confirm name/value |
| `rmm_update_account_variable` | UPDATE | Updates account-level variable |
| `rmm_delete_account_variable` | DESTRUCTIVE | Deletes account-level variable; irreversible |
| `rmm_create_site_variable` | WRITE | Creates site-level variable; confirm name/value |
| `rmm_update_site_variable` | UPDATE | Updates site-level variable |
| `rmm_delete_site_variable` | DESTRUCTIVE | Deletes site-level variable; irreversible |

---

## Summary by Classification

| Class | Count |
|-------|-------|
| READ | 48 |
| WRITE | 5 |
| UPDATE | 8 |
| DESTRUCTIVE | 5 |
| **Total** | **66** |

---

## Agent Implementation Guide

### READ tools
No special handling required. Call freely as part of information gathering.

### WRITE tools
Before calling, show a preview of what will be created:
```
About to create: <entity type>
  Name: <value>
  ...other fields...
Proceed? (yes/no)
```
Check for existing records with the same name first (duplicate detection).

### UPDATE tools
Before calling, show a diff of what will change:
```
About to update: <entity name> (<uid>)
  description: "old value" → "new value"
  ...
Proceed? (yes/no)
```
Send only the fields being changed (patch semantics).

### DESTRUCTIVE tools
Before calling, require explicit user approval with impact display:
```
⚠️  This action cannot be undone.
About to delete: <entity name> (<uid>)
Impact: <describe what will be removed/closed>
Type the name to confirm: ___
```
Log the action with timestamp, actor, and affected entity.
