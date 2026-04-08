# Tier 2 Tools Reference

API-level tools for granular control (Advanced).

## Account Operations (8 tools)

- **get-account** - Get account details
- **list-sites** - List all sites in account (paginated)
- **list-devices** - List all devices in account (paginated)
- **list-open-alerts** - List open alerts (paginated)
- **list-resolved-alerts** - List resolved alerts (paginated)
- **list-components** - List all components (paginated)
- **list-account-variables** - List account variables
- **list-users** - List account users

## Site Operations (9 tools)

- **get-site** - Get site details by UID
- **get-site-devices** - Get devices for site (raw API)
- **list-site-open-alerts** - List site open alerts (paginated)
- **list-site-resolved-alerts** - List site resolved alerts (paginated)
- **get-site-settings** - Get site settings
- **list-site-variables** - List site variables
- **list-site-filters** - List site device filters
- **create-site** - Create new site
- **update-site** - Update site properties

## Device Operations (9 tools)

- **get-device** - Get device by UID
- **get-device-by-id** - Get device by ID
- **get-device-by-mac** - Get device by MAC address
- **list-device-open-alerts** - List device open alerts
- **list-device-resolved-alerts** - List device resolved alerts
- **move-device** - Move device to different site
- **set-device-udf** - Set device UDF field
- **set-device-warranty** - Update device warranty
- **create-quick-job** - Create quick job for device

## Alert Operations (2 tools)

- **get-alert** - Get alert details by UID
- **resolve-alert** - Resolve an alert

## Job Operations (5 tools)

- **get-job** - Get job details
- **get-job-results** - Get job execution results
- **get-job-components** - Get job components
- **get-job-stdout** - Get job stdout output
- **get-job-stderr** - Get job stderr output

## Audit Operations (5 tools)

- **get-device-audit** - Get device audit data
- **get-device-software** - Get device software inventory
- **get-device-audit-by-mac** - Get audit by MAC address
- **get-esxi-audit** - Get ESXi host audit
- **get-printer-audit** - Get printer audit data

## Activity Operations (1 tool)

- **get-activity-logs** - Get account activity logs (paginated)

## System & Filter Operations (5 tools)

- **get-system-status** - Get API system status
- **get-rate-limit** - Get current rate limit status
- **get-pagination-config** - Get pagination configuration
- **list-default-filters** - List default device filters
- **list-custom-filters** - List custom device filters

## Variable & Proxy Operations (8 tools)

- **create-account-variable** - Create account variable
- **update-account-variable** - Update account variable
- **delete-account-variable** - Delete account variable
- **create-site-variable** - Create site variable
- **update-site-variable** - Update site variable
- **delete-site-variable** - Delete site variable
- **update-site-proxy** - Update site proxy settings
- **delete-site-proxy** - Delete site proxy settings

---

**Total:** 52 Tier 2 tools (all implemented)

## Usage

Use Tier 2 tools when:
- You need specific API operations not covered by Tier 1
- You're handling edge cases
- You need precise control over API parameters
- You're building custom workflows

## Implementation Note

All Tier 2 tools are direct 1:1 mappings to Datto RMM API endpoints from the OpenAPI specification.
