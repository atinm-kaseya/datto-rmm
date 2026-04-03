# datto-rmm-mcp-server

MCP (Model Context Protocol) server for Datto RMM. Enables AI assistants like Claude to interact with your Datto RMM account.

## Features

- **65 MCP Tools** organized in two tiers:
  - **🌟 Tier 1 (13 tools)**: Task-oriented composite tools for common workflows (recommended)
  - **🔧 Tier 2 (52 tools)**: API-level tools for granular control (advanced)
- **10 MCP Resources** for browsable data hierarchies and documentation
- **Full OAuth 2.0 support** with automatic token management
- **All 6 Datto platforms** supported (Pinotage, Merlot, Concord, Vidal, Zinfandel, Syrah)
- **Type-safe** - Built on the `datto-rmm-api` package

## Two-Tier Tool Architecture

### 🌟 Tier 1: Task-Oriented Tools (Recommended)

High-level composite tools that aggregate multiple API calls into single operations. Accept natural language inputs and return rich, formatted responses with recommendations.

**MSP Workflow:** Start of day triage (account-wide) → identify problem sites → drill into site → work within site context

#### Phase 1: Account Overview & Triage (✅ Complete)

| Tool | Purpose | Use When |
|------|---------|----------|
| `get-account-dashboard` | Start-of-day triage overview | "What needs attention today?" |
| `find-sites-with-issues` | Identify problem sites | "Which sites have issues?" |
| `get-site-health` | Complete site health dashboard | "Check Acme Corp site" |
| `search-devices` | Find devices across all sites | "Find web-server-01" (don't know which site) |

#### Phase 2: Device Health & Alert Analysis (✅ Complete)

| Tool | Purpose | Use When |
|------|---------|----------|
| `get-device-health` | Complete device health snapshot | "Check web-server-01 at Acme Corp" |
| `diagnose-device-issue` | AI-assisted troubleshooting | "Why is this device slow?" |
| `investigate-alert` | Deep alert analysis with patterns | "Why did this alert fire?" |
| `get-alert-summary` | Alert trending and analytics | "Show me alert trends this week" |

#### Phase 3: Operations & Bulk Actions (✅ Complete)

| Tool | Purpose | Use When |
|------|---------|----------|
| `list-site-devices` | Browse/filter devices in site | "Show me all servers at Acme Corp" |
| `get-site-alerts` | Site alert overview with grouping | "What alerts does this site have?" |
| `run-site-component` | Execute jobs on site devices | "Run disk cleanup on all servers" |
| `bulk-update-site-devices` | Mass device updates (site-scoped) | "Set warranty dates for all devices" |
| `get-account-analytics` | Usage metrics and trending | "Show device growth this quarter" |

**Example Workflow:**
```
1. Triage: get-account-dashboard → Shows 3 sites with critical alerts
2. Prioritize: find-sites-with-issues → Acme Corp has most problems
3. Site Health: get-site-health({ site: "Acme Corp" }) → 2 servers offline, 12 critical alerts
4. Investigate: get-device-health({ device: "web-server-01", site: "Acme Corp" }) → Disk 95% full
5. Remediate: run-site-component({ site: "Acme Corp", devices: ["web-server-01"], component: "Disk Cleanup" })
```

---

#### When to Use Which Tier

**🌟 Use Tier 1 (Task-Oriented) When:**
- Starting a new investigation ("What needs attention?")
- Working with natural inputs (site names, hostnames, not UIDs)
- Need recommendations for next steps
- Want aggregated data (multiple API calls in one)
- Performing common MSP workflows (triage, site health, diagnostics)
- Need formatted, readable output with context

**Examples:**
- "Show me sites with issues" → `find-sites-with-issues`
- "Check health of Acme Corp" → `get-site-health`
- "Why is web-server-01 slow?" → `diagnose-device-issue`

**🔧 Use Tier 2 (API-Level) When:**
- Need granular control over specific API operations
- Working with exact UIDs and parameters
- Tier 1 doesn't cover your specific edge case
- Building custom workflows or automation
- Need raw API responses for processing

**Examples:**
- "Update device UID abc123 with warranty '2027-12-31'" → `update-device` (Tier 2)
- "Get audit data for device xyz789" → `get-device-audit` (Tier 2)
- "List all components with category 'Backup'" → `list-components` (Tier 2)

**💡 Progressive Approach:**
1. Start with Tier 1 tools (simple, natural language)
2. Follow recommendations in tool outputs (they suggest next tools)
3. Drop to Tier 2 only when needed (specific API operations)
4. Mix both tiers in same workflow as needed

---

#### Recommended Tools Quick Reference

**Daily Triage:**
1. `get-account-dashboard` - See what needs attention
2. `find-sites-with-issues` - Prioritize sites
3. `get-site-health` - Investigate priority sites

**Device Troubleshooting:**
1. `get-device-health` - Complete device snapshot
2. `diagnose-device-issue` - AI-assisted diagnosis
3. `run-site-component` - Execute remediation

**Alert Management:**
1. `get-alert-summary` - See patterns and trends
2. `investigate-alert` - Deep dive into specific alert
3. `get-site-alerts` - Site-focused alert view

**Bulk Operations:**
1. `list-site-devices` - Identify target devices
2. `bulk-update-site-devices` - Preview changes (dry-run)
3. `bulk-update-site-devices` - Apply changes (dry_run: false)
4. `run-site-component` - Execute on multiple devices

**Reporting:**
1. `get-account-analytics` - Usage metrics and trends



### 🔧 Tier 2: API-Level Tools (Advanced)

Direct 1:1 mappings to Datto RMM API endpoints. Auto-generated from OpenAPI spec. Use for:
- Edge cases Tier 1 doesn't cover
- Granular control over specific operations
- Direct API access when needed

All 55 active API operations available. See [API Tools](#tier-2-api-level-tools-advanced) section below.

## Installation

```bash
npm install datto-rmm-mcp-server
# or
pnpm add datto-rmm-mcp-server
```

## Configuration

### Environment Variables Setup

For local development, create a `.env` file in the MCP server directory:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual credentials
# NEVER commit .env to version control!
```

The `.env` file is already listed in `.gitignore` to prevent accidental commits of sensitive credentials.

### Required Variables

The server requires the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATTO_API_KEY` | Yes | Your Datto RMM API key |
| `DATTO_API_SECRET` | Yes | Your Datto RMM API secret |
| `DATTO_PLATFORM` | No | Platform name (default: `merlot`) |

### Platform Options

- `pinotage` - Asia Pacific
- `merlot` - US East (default)
- `concord` - US West
- `vidal` - EU (Frankfurt)
- `zinfandel` - EU (London)
- `syrah` - Canada

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

## Available Tools

### 🌟 Tier 1: Task-Oriented Tools (Recommended)

Start with these tools for common workflows. They aggregate multiple API calls and provide rich, actionable responses.

#### Account Overview (Triage)

| Tool | Purpose | Returns |
|------|---------|---------|
| `get-account-dashboard` | Start-of-day overview | Critical sites, alert summary, device counts, recommended actions |
| `find-sites-with-issues` | Identify problem sites | Ranked sites with alerts/offline devices, common issue types |
| `search-devices` | Find device across all sites | Devices matching query with site context, alert counts, UIDs |

#### Site Operations

| Tool | Purpose | Returns |
|------|---------|---------|
| `get-site-health` | Complete site dashboard | Device stats, alerts by type, top problem devices, recommended actions |

**Typical workflow:**
1. `get-account-dashboard` → See what needs attention
2. `find-sites-with-issues` → Identify problem sites
3. `get-site-health` → Drill into specific site
4. Use device/alert tools to remediate

---

### 🔧 Tier 2: API-Level Tools (Advanced)

Direct API endpoint mappings for granular control. Use when Tier 1 tools don't cover your specific need.

#### Account Operations
| Tool | Description |
|------|-------------|
| `get-account` | Get account information and device status summary |
| `list-sites` | List all sites with filtering |
| `list-devices` | List all devices with filtering by hostname, site, type, OS |
| `list-users` | List account users |
| `list-account-variables` | List account-level variables |
| `list-components` | List available job components |
| `list-open-alerts` | List all open alerts |
| `list-resolved-alerts` | List resolved alerts |

#### Site Operations
| Tool | Description |
|------|-------------|
| `get-site` | Get detailed site information |
| `list-site-devices` | List devices in a site |
| `list-site-open-alerts` | List open alerts for a site |
| `list-site-resolved-alerts` | List resolved alerts for a site |
| `list-site-variables` | List site variables |
| `get-site-settings` | Get site settings (proxy, etc.) |
| `list-site-filters` | List device filters for a site |
| `create-site` | Create a new site |
| `update-site` | Update site details |

#### Device Operations
| Tool | Description |
|------|-------------|
| `get-device` | Get device details by UID |
| `get-device-by-id` | Get device by numeric ID |
| `get-device-by-mac` | Find devices by MAC address |
| `list-device-open-alerts` | List open alerts for a device |
| `list-device-resolved-alerts` | List resolved alerts for a device |
| `move-device` | Move device to another site |
| `create-quick-job` | Run a quick job on a device |
| `set-device-udf` | Set user-defined fields |
| `set-device-warranty` | Set warranty date |

#### Alert Operations
| Tool | Description |
|------|-------------|
| `get-alert` | Get alert details |
| `resolve-alert` | Resolve an open alert |

### Job Operations
| Tool | Description |
|------|-------------|
| `get-job` | Get job details |
| `get-job-components` | Get job components |
| `get-job-results` | Get job results for a device |
| `get-job-stdout` | Get job stdout output |
| `get-job-stderr` | Get job stderr output |

### Audit Operations
| Tool | Description |
|------|-------------|
| `get-device-audit` | Get hardware/system audit data |
| `get-device-software` | List installed software |
| `get-device-audit-by-mac` | Get audit by MAC address |
| `get-esxi-audit` | Get ESXi host audit (incl. VMs) |
| `get-printer-audit` | Get printer audit (incl. supplies) |

### Activity & Filters
| Tool | Description |
|------|-------------|
| `get-activity-logs` | Get activity logs with filtering |
| `list-default-filters` | List default device filters |
| `list-custom-filters` | List custom device filters |

### System Operations
| Tool | Description |
|------|-------------|
| `get-system-status` | Get API system status |
| `get-rate-limit` | Get current rate limit status |
| `get-pagination-config` | Get pagination configuration |

### Variable Operations
| Tool | Description |
|------|-------------|
| `create-account-variable` | Create account variable |
| `update-account-variable` | Update account variable |
| `delete-account-variable` | Delete account variable |
| `create-site-variable` | Create site variable |
| `update-site-variable` | Update site variable |
| `delete-site-variable` | Delete site variable |
| `update-site-proxy` | Configure site proxy |
| `delete-site-proxy` | Remove site proxy |

## Available Resources

Browse data hierarchies and documentation via MCP resources:

### Data Resources

| URI | Description |
|-----|-------------|
| `datto://account` | Account overview and device summary |
| `datto://sites` | List of all sites |
| `datto://sites/{siteUid}` | Site details and statistics |
| `datto://sites/{siteUid}/devices` | Devices in a specific site |
| `datto://devices/{deviceUid}` | Device details and status |
| `datto://alerts/open` | Open alerts summary |

### Documentation Resources

| URI | Description |
|-----|-------------|
| `datto://docs/workflows` | Common MSP workflows with recommended tool usage |
| `datto://docs/troubleshooting` | Issue-specific troubleshooting guides and resolution steps |
| `datto://docs/components` | Available component catalog with use cases |
| `datto://docs/alerts` | Alert type reference with typical causes |

**Using Documentation:**
AI assistants can browse these resources to understand best practices and recommended tool chains for common scenarios. For example, the workflows resource provides step-by-step guides for daily triage, device diagnostics, and bulk operations.

## Example Queries

Once connected, you can ask Claude things like:

**Daily Triage:**
- "What needs attention today?"
- "Show me sites with critical alerts"
- "Which sites should I focus on?"

**Site Investigation:**
- "Check the health of Acme Corp site"
- "What alerts does TechStart Inc have?"
- "Show me all servers at Legal Partners"
- "List offline devices at Acme Corp"

**Device Diagnostics:**
- "Check health of web-server-01"
- "Why is db-server-01 running slow?"
- "Find the device with hostname 'mail-server'"
- "What's wrong with device xyz123?"

**Alert Management:**
- "Show me alert trends this week"
- "Investigate alert abc456"
- "What are the most common alerts?"
- "Group alerts by device for Acme Corp"

**Bulk Operations:**
- "Run disk cleanup on all Acme Corp servers"
- "Update warranty dates for these devices"
- "Set patch group to 'Weekend' for all workstations"

**Reporting:**
- "Show device growth over the past month"
- "What's our alert resolution rate?"
- "How many jobs ran successfully this week?"

## Development

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Build
pnpm build

# Run in development mode (reads from .env)
pnpm dev

# Or pass env vars directly
DATTO_API_KEY=xxx DATTO_API_SECRET=yyy DATTO_PLATFORM=staging pnpm dev
```

**⚠️ Security Note:** Never commit `.env` to version control. It contains sensitive API credentials and is already listed in `.gitignore`.

## License

MIT
