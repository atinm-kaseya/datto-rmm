# datto-rmm-mcp-server

MCP (Model Context Protocol) server for Datto RMM. Enables AI assistants like Claude to interact with your Datto RMM account.

## Features

- **56 MCP Tools** organized in two tiers:
  - **🌟 Tier 1 (4 tools)**: Task-oriented composite tools for common workflows (recommended)
  - **🔧 Tier 2 (52 tools)**: API-level tools for granular control (advanced)
- **6 MCP Resources** for browsable data hierarchies
- **Full OAuth 2.0 support** with automatic token management
- **All 6 Datto platforms** supported (Pinotage, Merlot, Concord, Vidal, Zinfandel, Syrah)
- **Type-safe** - Built on the `datto-rmm-api` package

## Two-Tier Tool Architecture

### 🌟 Tier 1: Task-Oriented Tools (Recommended)

High-level composite tools that aggregate multiple API calls into single operations. Accept natural language inputs and return rich, formatted responses with recommendations.

**Phase 1 Tools (Available Now):**

| Tool | Purpose | Use When |
|------|---------|----------|
| `get-account-dashboard` | Start-of-day triage overview | "What needs attention today?" |
| `find-sites-with-issues` | Identify problem sites | "Which sites have issues?" |
| `get-site-health` | Complete site health dashboard | "Check Acme Corp site" |
| `search-devices` | Find devices across all sites | "Find web-server-01" (don't know which site) |

**Example Workflow:**
```
1. Start: get-account-dashboard → Shows 3 sites with critical alerts
2. Prioritize: find-sites-with-issues → Acme Corp has most problems
3. Investigate: get-site-health({ site: "Acme Corp" }) → 2 servers offline
4. Act: Use device/alert tools to remediate
```

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

Browse data hierarchies via MCP resources:

| URI | Description |
|-----|-------------|
| `datto://account` | Account overview |
| `datto://sites` | List of all sites |
| `datto://sites/{siteUid}` | Site details |
| `datto://sites/{siteUid}/devices` | Devices in a site |
| `datto://devices/{deviceUid}` | Device details |
| `datto://alerts/open` | Open alerts summary |

## Example Queries

Once connected, you can ask Claude things like:

- "List all my Datto RMM sites"
- "Show me all offline devices"
- "What are the open alerts for the Main Office site?"
- "Get the hardware specs for device xyz123"
- "What software is installed on the server?"
- "Run the Windows Update component on device abc456"
- "Show me the activity logs from the last hour"

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
