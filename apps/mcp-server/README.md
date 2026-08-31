# datto-rmm-mcp-server

MCP (Model Context Protocol) server for Datto RMM. Enables AI assistants like Claude to interact with your Datto RMM account.

## Features

- **58 MCP tools** in two tiers — 14 core tools always loaded, 44 loaded on demand
- **Lazy loading** — tools are grouped into 10 entity-based groups; load only what you need
- **JSON response envelope** — every tool returns `{ ok, data, count, next_page, _enhanced }`
- **ID resolution** — `_enhanced` field resolves UIDs to human-readable names on every response
- **Structured errors** — machine-readable error codes (`entity_not_found`, `rate_limited`, etc.)
- **All 6 Datto platforms** supported (Pinotage, Merlot, Concord, Vidal, Zinfandel, Syrah)

## Tool Architecture

### Tier 1 — Core Tools (always loaded)

13 task-oriented composite tools for common MSP workflows, plus the `rmm_load_tools` meta-tool. These are always available without any setup.

| Tool | Purpose |
|------|---------|
| `rmm_get_account_dashboard` | Start-of-day triage — critical sites, alert summary, recommended actions |
| `rmm_find_sites_with_issues` | Ranked list of sites with alerts and offline devices |
| `rmm_search_devices` | Find devices across all sites by hostname, IP, site name, or OS |
| `rmm_get_site_health` | Complete site health dashboard — devices, alerts, top problems |
| `rmm_get_device_health` | Full device health snapshot — status, alerts, audit summary |
| `rmm_diagnose_device_issue` | AI-assisted troubleshooting for a specific device |
| `rmm_investigate_alert` | Deep alert analysis with context and patterns |
| `rmm_get_alert_summary` | Alert trending and analytics |
| `rmm_list_site_devices` | Browse and filter devices in a site |
| `rmm_get_site_alerts` | Site alert overview with grouping |
| `rmm_run_site_component` | Execute a component on devices in a site |
| `rmm_bulk_update_site_devices` | Mass device field updates (site-scoped) |
| `rmm_get_account_analytics` | Usage metrics and trending |
| `rmm_load_tools` | Load a Tier 2 group for this session |

**Typical workflow:**
```
rmm_get_account_dashboard       → What needs attention today?
rmm_find_sites_with_issues      → Acme Corp has 3 critical alerts
rmm_get_site_health             → 2 servers offline, disk alerts
rmm_get_device_health           → web-server-01: disk 95% full
rmm_run_site_component          → Run "Disk Cleanup" on web-server-01
```

---

### Tier 2 — API-Level Tools (lazy loaded)

Direct API mappings for granular control. Load the group you need with `rmm_load_tools` before calling any tool in it.

```
rmm_load_tools({ group: "devices" })   → unlocks device tools for this session
```

#### Group: `account`
| Tool | Description |
|------|-------------|
| `rmm_get_account` | Account information and device status summary |
| `rmm_list_sites` | All sites with pagination |
| `rmm_list_devices` | All devices; pass `siteUid` to scope to a site |
| `rmm_list_users` | Account users |
| `rmm_list_account_variables` | Account-level variables |
| `rmm_list_components` | Available automation components |
| `rmm_list_alerts` | Open or resolved alerts; scope by `siteUid` or `deviceUid` |
| `rmm_get_api_metering_summary` | API usage metering |

#### Group: `sites`
| Tool | Description |
|------|-------------|
| `rmm_get_site` | Site details by UID |
| `rmm_list_site_variables` | Variables for a site |
| `rmm_get_site_settings` | Site settings including proxy configuration |
| `rmm_list_site_filters` | Device filters for a site |
| `rmm_create_site` | Create a new site |
| `rmm_update_site` | Update site fields (patch — only fields provided are changed) |
| `rmm_update_site_proxy` | Configure proxy for a site |
| `rmm_delete_site_proxy` | Remove proxy configuration |

#### Group: `devices`
| Tool | Description |
|------|-------------|
| `rmm_get_device` | Device details by UID |
| `rmm_get_device_by_id` | Device by numeric ID |
| `rmm_get_device_by_mac` | Find devices by MAC address |
| `rmm_move_device` | Move device to another site |
| `rmm_run_job` | Execute a component as a quick job on a device |
| `rmm_set_device_udf` | Set user-defined fields (UDF1–UDF30) |
| `rmm_set_device_warranty` | Set or clear warranty date |

#### Group: `alerts`
| Tool | Description |
|------|-------------|
| `rmm_get_alert` | Alert details by UID |
| `rmm_resolve_alert` | Resolve (close) an alert |

#### Group: `jobs`
| Tool | Description |
|------|-------------|
| `rmm_get_job` | Job details by UID |
| `rmm_get_job_components` | Components that make up a job |
| `rmm_get_job_status` | Job execution status + stdout (on success) or stderr (on failure) |

#### Group: `audit`
| Tool | Description |
|------|-------------|
| `rmm_get_device_audit` | Hardware/OS/network audit — auto-routes to ESXi or printer endpoint by device class |
| `rmm_get_device_software` | Installed software list |
| `rmm_get_device_audit_by_mac` | Audit data by MAC address |
| `rmm_list_patches` | Patch inventory for a device or site; filter by `installStatus` |

#### Group: `activity`
| Tool | Description |
|------|-------------|
| `rmm_list_activity_logs` | Activity logs with filtering; cursor-based pagination via `cursor` param |

#### Group: `filters`
| Tool | Description |
|------|-------------|
| `rmm_list_default_filters` | Default device filters |
| `rmm_list_custom_filters` | Custom device filters |

#### Group: `system`
| Tool | Description |
|------|-------------|
| `rmm_get_system_status` | API system status |
| `rmm_get_rate_limit` | Current rate limit status |
| `rmm_get_pagination_config` | Default and max page sizes |

#### Group: `variables`
| Tool | Description |
|------|-------------|
| `rmm_create_account_variable` | Create account-level variable |
| `rmm_update_account_variable` | Update account variable |
| `rmm_delete_account_variable` | Delete account variable |
| `rmm_create_site_variable` | Create site variable |
| `rmm_update_site_variable` | Update site variable |
| `rmm_delete_site_variable` | Delete site variable |

---

## Response Format

Every tool returns a consistent JSON envelope:

**Success:**
```json
{
  "ok": true,
  "data": { ... },
  "count": 42,
  "next_page": "https://...",
  "_enhanced": {
    "sites": { "site-uid-1": "Acme Corp" },
    "devices": { "device-uid-1": "web-server-01" }
  }
}
```

**Error:**
```json
{
  "ok": false,
  "error": "entity_not_found",
  "detail": "No device matched UID abc123",
  "code": 404
}
```

Error codes: `entity_not_found` · `validation_error` · `tool_not_loaded` · `auth_error` · `rate_limited` · `permission_denied` · `duplicate_detected` · `api_error`

---

## Installation

```bash
npm install datto-rmm-mcp-server
# or
pnpm add datto-rmm-mcp-server
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATTO_API_KEY` | Yes | Datto RMM API key |
| `DATTO_API_SECRET` | Yes | Datto RMM API secret |
| `DATTO_PLATFORM` | No | Platform (default: `merlot`) |

**Platform options:** `pinotage` (APAC) · `merlot` (US East) · `concord` (US West) · `vidal` (EU Frankfurt) · `zinfandel` (EU London) · `syrah` (Canada)

```bash
cp .env.example .env
# Edit .env — never commit it to version control
```

## Usage with Claude Desktop

```json
{
  "mcpServers": {
    "datto-rmm": {
      "command": "npx",
      "args": ["datto-rmm-mcp-server"],
      "env": {
        "DATTO_API_KEY": "your-api-key",
        "DATTO_API_SECRET": "your-api-secret",
        "DATTO_PLATFORM": "merlot"
      }
    }
  }
}
```

## Example Queries

**Daily triage:**
- "What needs attention today?"
- "Which sites have critical alerts?"

**Device troubleshooting:**
- "Check health of web-server-01"
- "Why is db-server-01 slow?"
- "Find the device with MAC AA:BB:CC:DD:EE:FF"

**Alert management:**
- "Show open alerts for Acme Corp"
- "Resolve alert abc456"
- "What are the most common alert types this week?"

**Jobs and automation:**
- "Run disk cleanup on web-server-01 at Acme Corp"
- "What's the status of job xyz789?"

**Patching:**
- "What patches are pending on web-server-01?"
- "Show approved-pending patches for Acme Corp site"

**Bulk operations:**
- "Update warranty dates for all devices at Acme Corp"
- "Set UDF3 to 'Production' on all servers at TechStart Inc"

## Development

```bash
pnpm install
pnpm build
pnpm dev          # reads from .env
pnpm test
pnpm typecheck
```

## Available Resources

| URI | Description |
|-----|-------------|
| `datto://account` | Account overview |
| `datto://sites` | All sites |
| `datto://sites/{siteUid}` | Site details |
| `datto://sites/{siteUid}/devices` | Devices in a site |
| `datto://devices/{deviceUid}` | Device details |
| `datto://alerts/open` | Open alerts summary |
| `datto://docs/workflows` | Common MSP workflow guides |
| `datto://docs/troubleshooting` | Troubleshooting reference |
| `datto://docs/components` | Component catalog |
| `datto://docs/alerts` | Alert type reference |

## License

MIT
