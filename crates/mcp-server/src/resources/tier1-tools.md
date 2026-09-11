# Tier 1 Tools Reference

Task-oriented composite tools for common MSP workflows.

## Account Overview (4 tools)

### get-account-dashboard
High-level account overview - first tool of the day.
- **Purpose:** Triage and prioritization
- **Returns:** Critical sites, alert summary, recommendations
- **Params:** time_range (today/week/month)

### find-sites-with-issues
Find which sites need attention right now.
- **Purpose:** Identify problem sites
- **Returns:** Sites ranked by severity with issue breakdown
- **Params:** severity, min_offline_devices, sort_by, limit

### search-devices
Search across all sites for devices.
- **Purpose:** Find devices when site is unknown
- **Returns:** Devices with site context and alert counts
- **Params:** query, status, has_alerts, limit

### get-account-analytics
Account-wide usage metrics and trends.
- **Purpose:** Capacity planning and reporting
- **Returns:** Device growth, site patterns, alert trends
- **Params:** time_range (default: month)

## Site Operations (5 tools)

### get-site-health
Complete site health dashboard.
- **Purpose:** Primary entry point after triage
- **Returns:** Device stats, alerts, top problem devices, recommendations
- **Params:** site, include_device_details

### list-site-devices
Browse and filter devices within a site.
- **Purpose:** Device inventory and filtering
- **Returns:** Rich device list with filtering/sorting
- **Params:** site, status, has_alerts

### get-site-alerts
Alert overview for specific site.
- **Purpose:** Site-level alert analysis
- **Returns:** Alerts grouped by device/type with remediation tips
- **Params:** site, severity

### run-site-component
Execute component on site devices.
- **Purpose:** Run jobs with safety checks
- **Returns:** Execution plan or results
- **Params:** site, component, devices, dry_run

### bulk-update-site-devices
Bulk update device properties.
- **Purpose:** Mass configuration changes
- **Returns:** Preview or execution results
- **Params:** site, devices, updates, dry_run (default: true)

## Device Operations (2 tools)

### get-device-health
Complete device health snapshot.
- **Purpose:** Deep device diagnostics
- **Returns:** Device overview, hardware details, alerts, recommendations
- **Params:** device, site (optional), include_history

### diagnose-device-issue
Diagnostic framework for device issues.
- **Purpose:** Structured problem analysis
- **Returns:** Diagnostic report with analysis framework
- **Params:** device, issue

## Alert Management (2 tools)

### get-alert-summary
Alert trending and analytics.
- **Purpose:** Understand alert patterns
- **Returns:** Alert counts by grouping, trending, common types
- **Params:** site (optional), severity, group_by, time_range

### investigate-alert
Deep alert investigation.
- **Purpose:** Root cause analysis
- **Returns:** Alert context, similar alerts, resolution suggestions
- **Params:** alert_uid, include_similar

---

**Total:** 13 Tier 1 tools (all implemented)
