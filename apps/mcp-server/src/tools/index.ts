import type { DattoClient } from 'datto-rmm-api';

// Tier 1: Task-Oriented Composite Tools
import * as compositeTools from './composite/index.js';

// Tier 2: API-Level Tools
import * as accountTools from './account.js';
import * as siteTools from './sites.js';
import * as deviceTools from './devices.js';
import * as alertTools from './alerts.js';
import * as jobTools from './jobs.js';
import * as auditTools from './audit.js';
import * as activityTools from './activity.js';
import * as filterTools from './filters.js';
import * as systemTools from './system.js';
import * as variableTools from './variables.js';

/**
 * Tool definition with schema and handler.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (client: DattoClient, args: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
}

/**
 * All available tools.
 * 
 * Tools are organized in two tiers:
 * - Tier 1 (🌟 Task-Oriented): High-level composite tools for common workflows (recommended)
 * - Tier 2 (🔧 Advanced): Low-level API mappings for granular control
 */
export const tools: ToolDefinition[] = [
  // ==================== 🌟 TIER 1: TASK-ORIENTED TOOLS ====================
  
  // Account Overview (Triage & Prioritization)
  {
    name: 'rmm_get_account_dashboard',
    description: '🌟 [Tier 1] Get high-level account overview for start-of-day triage. Shows critical sites, alert summary, and recommended actions.',
    inputSchema: {
      type: 'object',
      properties: {
        time_range: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Time range for activity metrics (default: today)',
        },
      },
    },
    handler: (client, args) => compositeTools.getAccountDashboard(client, args as Parameters<typeof compositeTools.getAccountDashboard>[1]),
  },
  {
    name: 'rmm_find_sites_with_issues',
    description: '🌟 [Tier 1] Find which sites need attention right now. Returns ranked list of sites with alerts and offline devices.',
    inputSchema: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['critical', 'warning', 'all'],
          description: 'Minimum severity level (default: critical)',
        },
        min_offline_devices: {
          type: 'number',
          description: 'Minimum offline device count to include site (default: 1)',
        },
        sort_by: {
          type: 'string',
          enum: ['alerts', 'offline_devices', 'combined'],
          description: 'Sort order (default: combined)',
        },
        limit: {
          type: 'number',
          description: 'Maximum sites to return (default: 10)',
        },
      },
    },
    handler: (client, args) => compositeTools.findSitesWithIssues(client, args as Parameters<typeof compositeTools.findSitesWithIssues>[1]),
  },
  {
    name: 'rmm_search_devices',
    description: '🌟 [Tier 1] Search for devices across all sites using natural language. Matches hostname, IP, site name, or OS. Use when you don\'t know which site contains a device.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term (matches hostname, IP, site, OS)',
        },
        status: {
          type: 'string',
          enum: ['online', 'offline', 'all'],
          description: 'Filter by device status (default: all)',
        },
        has_alerts: {
          type: 'boolean',
          description: 'Only devices with open alerts (default: false)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 20)',
        },
      },
    },
    handler: (client, args) => compositeTools.searchDevices(client, args as Parameters<typeof compositeTools.searchDevices>[1]),
  },
  {
    name: 'rmm_get_site_health',
    description: '🌟 [Tier 1] Get comprehensive site health dashboard. Shows devices, alerts, top problem devices, and recommended actions. Primary entry point for site-focused work.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or UID',
        },
        include_device_details: {
          type: 'boolean',
          description: 'Include full device list vs summary (default: false)',
        },
      },
      required: ['site'],
    },
    handler: (client, args) => compositeTools.getSiteHealth(client, args as any),
  },
  {
    name: 'rmm_get_device_health',
    description: '🌟 [Tier 1] Get complete device health snapshot. Shows status, alerts, hardware, recent jobs, and recommendations. Use for device troubleshooting.',
    inputSchema: {
      type: 'object',
      properties: {
        device: {
          type: 'string',
          description: 'Device identifier: hostname, UID, or MAC address',
        },
        site: {
          type: 'string',
          description: 'Site name or UID (optional, helps resolve hostname)',
        },
        include_history: {
          type: 'boolean',
          description: 'Include recent jobs and activity (default: true)',
        },
      },
      required: ['device'],
    },
    handler: (client, args) => compositeTools.getDeviceHealth(client, args as any),
  },
  {
    name: 'rmm_diagnose_device_issue',
    description: '🌟 [Tier 1] AI-assisted device troubleshooting. Analyzes device state, recent changes, and provides actionable diagnosis with prioritized remediation steps.',
    inputSchema: {
      type: 'object',
      properties: {
        device: {
          type: 'string',
          description: 'Device identifier: hostname, UID, or MAC address',
        },
        site: {
          type: 'string',
          description: 'Site name or UID (optional, helps resolve device)',
        },
        issue: {
          type: 'string',
          description: 'Brief description of problem (e.g., "slow performance", "backup failing")',
        },
      },
      required: ['device', 'issue'],
    },
    handler: (client, args) => compositeTools.diagnoseDeviceIssue(client, args as any),
  },
  {
    name: 'rmm_investigate_alert',
    description: '🌟 [Tier 1] Deep alert analysis with pattern detection. Finds similar alerts across devices, assesses impact, and provides resolution suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        alert_uid: {
          type: 'string',
          description: 'Alert UID to investigate',
        },
        include_similar: {
          type: 'boolean',
          description: 'Find similar alerts on other devices (default: true)',
        },
      },
      required: ['alert_uid'],
    },
    handler: (client, args) => compositeTools.investigateAlert(client, args as any),
  },
  {
    name: 'rmm_get_alert_summary',
    description: '🌟 [Tier 1] Alert trending and analytics. Groups alerts by type/device/site, shows patterns, and identifies most affected areas.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Filter to specific site (optional, account-wide if omitted)',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'warning', 'all'],
          description: 'Filter by severity (default: all)',
        },
        group_by: {
          type: 'string',
          enum: ['device', 'type', 'site'],
          description: 'Group alerts by dimension (default: type)',
        },
        time_range: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Time range for analysis (default: today)',
        },
      },
    },
    handler: (client, args) => compositeTools.getAlertSummary(client, args as any),
  },
  {
    name: 'rmm_list_site_devices',
    description: '🌟 [Tier 1] Browse and filter devices within a site. Supports filtering by status, type, and alert presence with multiple sort options.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site identifier: name or UID',
        },
        status: {
          type: 'string',
          enum: ['online', 'offline', 'all'],
          description: 'Filter by online status (default: all)',
        },
        type: {
          type: 'string',
          description: 'Filter by device type (desktop, laptop, server, etc.)',
        },
        has_alerts: {
          type: 'boolean',
          description: 'Only show devices with open alerts (default: false)',
        },
        sort_by: {
          type: 'string',
          enum: ['name', 'alerts', 'last_seen'],
          description: 'Sort order (default: name)',
        },
      },
      required: ['site'],
    },
    handler: (client, args) => compositeTools.listSiteDevices(client, args as any),
  },
  {
    name: 'rmm_get_site_alerts',
    description: '🌟 [Tier 1] Alert overview for a specific site. Groups alerts by device or type, shows severity breakdown, and provides remediation recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site identifier: name or UID',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'warning', 'all'],
          description: 'Filter by severity (default: all)',
        },
        group_by: {
          type: 'string',
          enum: ['device', 'type'],
          description: 'Group alerts by device or type (default: type)',
        },
      },
      required: ['site'],
    },
    handler: (client, args) => compositeTools.getSiteAlerts(client, args as any),
  },
  {
    name: 'rmm_run_site_component',
    description: '🌟 [Tier 1] Execute a component (quick job, script) on devices within a site. Site-scoped for safety. Supports dry-run mode to preview before execution.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site identifier: name or UID',
        },
        devices: {
          oneOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
          ],
          description: 'Device selection: list of hostnames/UIDs or "all"',
        },
        component: {
          type: 'string',
          description: 'Component name or UID',
        },
        variables: {
          type: 'object',
          description: 'Component variables (optional)',
        },
        schedule: {
          type: 'string',
          description: 'Schedule: "now" or ISO datetime string (default: now)',
        },
        dry_run: {
          type: 'boolean',
          description: 'Preview only, don\'t execute (default: false)',
        },
      },
      required: ['site', 'devices', 'component'],
    },
    handler: (client, args) => compositeTools.runSiteComponent(client, args as any),
  },
  {
    name: 'rmm_bulk_update_site_devices',
    description: '🌟 [Tier 1] Bulk update device properties (UDFs, warranty, description) across devices in a site. Site-scoped for safety. Supports dry-run mode.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site identifier: name or UID',
        },
        devices: {
          oneOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
          ],
          description: 'Device selection: list of hostnames/UIDs or "all"',
        },
        updates: {
          type: 'object',
          description: 'Updates to apply (description, warranty, udf, etc.)',
          properties: {
            description: { type: 'string' },
            warranty: { type: 'string' },
            udf: {
              type: 'object',
              description: 'User-defined fields',
            },
          },
        },
        dry_run: {
          type: 'boolean',
          description: 'Preview only, don\'t apply changes (default: true)',
        },
      },
      required: ['site', 'devices', 'updates'],
    },
    handler: (client, args) => compositeTools.bulkUpdateSiteDevices(client, args as any),
  },
  {
    name: 'rmm_get_account_analytics',
    description: '🌟 [Tier 1] Account-wide usage metrics and trends. Shows device growth, site statistics, alert patterns, and capacity planning insights.',
    inputSchema: {
      type: 'object',
      properties: {
        time_range: {
          type: 'string',
          enum: ['week', 'month', 'quarter'],
          description: 'Time range for trending analysis (default: month)',
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['devices', 'alerts', 'sites'],
          },
          description: 'Metrics to include (default: all)',
        },
      },
    },
    handler: (client, args) => compositeTools.getAccountAnalytics(client, args as any),
  },

  // ==================== META TOOL ====================
  {
    name: 'rmm_load_tools',
    description: 'Load a group of Tier 2 tools for this session. Call before using any Tier 2 tool. Available groups: account, sites, devices, alerts, jobs, audit, activity, filters, system, variables. Returns the list of tools now available.',
    inputSchema: {
      type: 'object',
      properties: {
        group: {
          type: 'string',
          enum: ['account', 'sites', 'devices', 'alerts', 'jobs', 'audit', 'activity', 'filters', 'system', 'variables'],
          description: 'Tool group to activate',
        },
      },
      required: ['group'],
    },
    handler: async (_client, _args) => ({
      content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, data: { message: 'handled by server' } }) }],
    }),
  },

  // ==================== 🔧 TIER 2: API-LEVEL TOOLS (ADVANCED) ====================
  
  // Account Tools
  {
    name: 'rmm_get_account',
    description: '🔧 [Advanced] Get raw account information including device status summary',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: (client) => accountTools.getAccount(client),
  },
  {
    name: 'rmm_list_sites',
    description: '🔧 [Advanced] List all sites (raw API). Use rmm_get_site_health for richer site information.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        max: { type: 'number', description: 'Results per page (default: 50, max: 250)' },
        siteName: { type: 'string', description: 'Filter by site name (partial match)' },
      },
    },
    handler: (client, args) => accountTools.listSites(client, args as Parameters<typeof accountTools.listSites>[1]),
  },
  {
    name: 'rmm_list_devices',
    description: '🔧 [Advanced] List all devices (raw API) or devices in a specific site if siteUid is provided. Use rmm_search_devices for natural language search.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page (max: 250)' },
        hostname: { type: 'string', description: 'Filter by hostname (partial match)' },
        siteName: { type: 'string', description: 'Filter by site name (partial match)' },
        deviceType: { type: 'string', description: 'Filter by device type' },
        operatingSystem: { type: 'string', description: 'Filter by OS (partial match)' },
        filterId: { type: 'number', description: 'Apply a device filter by ID' },
        siteUid: { type: 'string', description: 'If provided, list devices for this site only' },
      },
    },
    handler: (client, args) => accountTools.listDevices(client, args as Parameters<typeof accountTools.listDevices>[1]),
  },
  {
    name: 'rmm_list_users',
    description: 'List all users in the Datto RMM account',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
    },
    handler: (client, args) => accountTools.listUsers(client, args as Parameters<typeof accountTools.listUsers>[1]),
  },
  {
    name: 'rmm_list_account_variables',
    description: 'List all account-level variables',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
    },
    handler: (client, args) => accountTools.listAccountVariables(client, args as Parameters<typeof accountTools.listAccountVariables>[1]),
  },
  {
    name: 'rmm_list_components',
    description: 'List all available job components in the account',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
    },
    handler: (client, args) => accountTools.listComponents(client, args as Parameters<typeof accountTools.listComponents>[1]),
  },
  {
    name: 'rmm_list_alerts',
    description: '🔧 [Advanced] List alerts with flexible routing. Defaults to open alerts account-wide. Use siteUid or deviceUid to scope. Use rmm_get_alert_summary for analytics.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'resolved'], description: 'Alert status (default: open)' },
        siteUid: { type: 'string', description: 'Filter to a specific site' },
        deviceUid: { type: 'string', description: 'Filter to a specific device (takes precedence over siteUid)' },
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
        muted: { type: 'boolean', description: 'Filter by muted status' },
      },
    },
    handler: (client, args) => accountTools.listAlerts(client, args as Parameters<typeof accountTools.listAlerts>[1]),
  },
  {
    name: 'rmm_get_api_metering_summary',
    description: 'Get API call metering statistics for this account. Returns total calls, breakdown by origin (mcp vs api), top endpoints, top MCP agents, and error rate. Optionally filter by origin.',
    inputSchema: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          enum: ['mcp', 'api'],
          description: 'Filter by call origin (default: all)',
        },
      },
    },
    handler: (client, args) => accountTools.getMeteringSummary(client, args as Parameters<typeof accountTools.getMeteringSummary>[1]),
  },

  // Site Tools
  {
    name: 'rmm_get_site',
    description: '🔧 [Advanced] Get raw site information. Use rmm_get_site_health for comprehensive site overview.',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
      },
      required: ['siteUid'],
    },
    handler: (client, args) => siteTools.getSite(client, args as Parameters<typeof siteTools.getSite>[1]),
  },
  {
    name: 'rmm_list_site_variables',
    description: 'List variables for a specific site',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
      required: ['siteUid'],
    },
    handler: (client, args) => siteTools.listSiteVariables(client, args as Parameters<typeof siteTools.listSiteVariables>[1]),
  },
  {
    name: 'rmm_get_site_settings',
    description: 'Get settings for a specific site (including proxy configuration)',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
      },
      required: ['siteUid'],
    },
    handler: (client, args) => siteTools.getSiteSettings(client, args as Parameters<typeof siteTools.getSiteSettings>[1]),
  },
  {
    name: 'rmm_list_site_filters',
    description: 'List device filters for a specific site',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
      required: ['siteUid'],
    },
    handler: (client, args) => siteTools.listSiteFilters(client, args as Parameters<typeof siteTools.listSiteFilters>[1]),
  },
  {
    name: 'rmm_create_site',
    description: 'Create a new site in the account',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the site' },
        description: { type: 'string', description: 'Site description' },
        notes: { type: 'string', description: 'Site notes' },
        onDemand: { type: 'boolean', description: 'Enable on-demand mode' },
        splashtopAutoInstall: { type: 'boolean', description: 'Auto-install Splashtop' },
      },
      required: ['name'],
    },
    handler: (client, args) => siteTools.createSite(client, args as Parameters<typeof siteTools.createSite>[1]),
  },
  {
    name: 'rmm_update_site',
    description: 'Update an existing site',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
        name: { type: 'string', description: 'New name for the site' },
        description: { type: 'string', description: 'New description' },
        notes: { type: 'string', description: 'New notes' },
        onDemand: { type: 'boolean', description: 'Enable/disable on-demand mode' },
        splashtopAutoInstall: { type: 'boolean', description: 'Enable/disable Splashtop auto-install' },
      },
      required: ['siteUid'],
    },
    handler: (client, args) => siteTools.updateSite(client, args as Parameters<typeof siteTools.updateSite>[1]),
  },

  // Device Tools
  {
    name: 'rmm_get_device',
    description: '🔧 [Advanced] Get raw device information by UID. Use rmm_get_device_health for comprehensive health snapshot.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUid: { type: 'string', description: 'The unique ID of the device' },
      },
      required: ['deviceUid'],
    },
    handler: (client, args) => deviceTools.getDevice(client, args as Parameters<typeof deviceTools.getDevice>[1]),
  },
  {
    name: 'rmm_get_device_by_id',
    description: 'Get device information by its numeric ID',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'The numeric ID of the device' },
      },
      required: ['deviceId'],
    },
    handler: (client, args) => deviceTools.getDeviceById(client, args as Parameters<typeof deviceTools.getDeviceById>[1]),
  },
  {
    name: 'rmm_get_device_by_mac',
    description: 'Find devices by MAC address (format: XXXXXXXXXXXX, no colons)',
    inputSchema: {
      type: 'object',
      properties: {
        macAddress: { type: 'string', description: 'MAC address without separators' },
      },
      required: ['macAddress'],
    },
    handler: (client, args) => deviceTools.getDeviceByMac(client, args as Parameters<typeof deviceTools.getDeviceByMac>[1]),
  },
  {
    name: 'rmm_move_device',
    description: 'Move a device from one site to another',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUid: { type: 'string', description: 'The unique ID of the device to move' },
        siteUid: { type: 'string', description: 'The unique ID of the target site' },
      },
      required: ['deviceUid', 'siteUid'],
    },
    handler: (client, args) => deviceTools.moveDevice(client, args as Parameters<typeof deviceTools.moveDevice>[1]),
  },
  {
    name: 'rmm_run_job',
    description: 'Run a quick job on a device using a component',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUid: { type: 'string', description: 'The unique ID of the device' },
        componentUid: { type: 'string', description: 'UID of the component to run' },
        variables: {
          type: 'array',
          description: 'Variables to pass to the component',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
      },
      required: ['deviceUid', 'componentUid'],
    },
    handler: (client, args) => deviceTools.runJob(client, args as Parameters<typeof deviceTools.runJob>[1]),
  },
  {
    name: 'rmm_set_device_udf',
    description: 'Set user-defined fields (UDF1-UDF30) on a device',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUid: { type: 'string', description: 'The unique ID of the device' },
        udf1: { type: 'string', description: 'User defined field 1' },
        udf2: { type: 'string', description: 'User defined field 2' },
        udf3: { type: 'string', description: 'User defined field 3' },
        udf4: { type: 'string', description: 'User defined field 4' },
        udf5: { type: 'string', description: 'User defined field 5' },
        // ... udf6-udf30 follow the same pattern
      },
      required: ['deviceUid'],
    },
    handler: (client, args) => deviceTools.setDeviceUdf(client, args as Parameters<typeof deviceTools.setDeviceUdf>[1]),
  },
  {
    name: 'rmm_set_device_warranty',
    description: 'Set the warranty date for a device (format: YYYY-MM-DD, or null to clear)',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUid: { type: 'string', description: 'The unique ID of the device' },
        warrantyDate: { type: ['string', 'null'], description: 'Warranty date (YYYY-MM-DD) or null to clear' },
      },
      required: ['deviceUid', 'warrantyDate'],
    },
    handler: (client, args) => deviceTools.setDeviceWarranty(client, args as Parameters<typeof deviceTools.setDeviceWarranty>[1]),
  },

  // Alert Tools
  {
    name: 'rmm_get_alert',
    description: '🔧 [Advanced] Get raw alert information by UID. Use rmm_investigate_alert for deep analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        alertUid: { type: 'string', description: 'The unique ID of the alert' },
      },
      required: ['alertUid'],
    },
    handler: (client, args) => alertTools.getAlert(client, args as Parameters<typeof alertTools.getAlert>[1]),
  },
  {
    name: 'rmm_resolve_alert',
    description: 'Resolve (close) an open alert',
    inputSchema: {
      type: 'object',
      properties: {
        alertUid: { type: 'string', description: 'The unique ID of the alert to resolve' },
      },
      required: ['alertUid'],
    },
    handler: (client, args) => alertTools.resolveAlert(client, args as Parameters<typeof alertTools.resolveAlert>[1]),
  },

  // Job Tools
  {
    name: 'rmm_get_job',
    description: '🔧 [Advanced] Get raw job information by UID',
    inputSchema: {
      type: 'object',
      properties: {
        jobUid: { type: 'string', description: 'The unique ID of the job' },
      },
      required: ['jobUid'],
    },
    handler: (client, args) => jobTools.getJob(client, args as Parameters<typeof jobTools.getJob>[1]),
  },
  {
    name: 'rmm_get_job_components',
    description: 'Get the components of a job',
    inputSchema: {
      type: 'object',
      properties: {
        jobUid: { type: 'string', description: 'The unique ID of the job' },
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
      required: ['jobUid'],
    },
    handler: (client, args) => jobTools.getJobComponents(client, args as Parameters<typeof jobTools.getJobComponents>[1]),
  },
  {
    name: 'rmm_get_job_status',
    description: 'Get job execution status and results for a specific device. Includes stdout if the job completed successfully.',
    inputSchema: {
      type: 'object',
      properties: {
        jobUid: { type: 'string', description: 'The unique ID of the job' },
        deviceUid: { type: 'string', description: 'The unique ID of the device' },
      },
      required: ['jobUid', 'deviceUid'],
    },
    handler: (client, args) => jobTools.getJobStatus(client, args as Parameters<typeof jobTools.getJobStatus>[1]),
  },

  // ==================== Audit Tools ====================
  {
    name: 'rmm_get_device_audit',
    description: 'Get hardware and system audit data for a device',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUid: { type: 'string', description: 'The unique ID of the device' },
      },
      required: ['deviceUid'],
    },
    handler: (client, args) => auditTools.getDeviceAudit(client, args as Parameters<typeof auditTools.getDeviceAudit>[1]),
  },
  {
    name: 'rmm_get_device_software',
    description: 'Get list of installed software on a device',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUid: { type: 'string', description: 'The unique ID of the device' },
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
      required: ['deviceUid'],
    },
    handler: (client, args) => auditTools.getDeviceSoftware(client, args as Parameters<typeof auditTools.getDeviceSoftware>[1]),
  },
  {
    name: 'rmm_get_device_audit_by_mac',
    description: 'Get device audit data by MAC address',
    inputSchema: {
      type: 'object',
      properties: {
        macAddress: { type: 'string', description: 'MAC address without separators' },
      },
      required: ['macAddress'],
    },
    handler: (client, args) => auditTools.getDeviceAuditByMac(client, args as Parameters<typeof auditTools.getDeviceAuditByMac>[1]),
  },
  {
    name: 'rmm_list_patches',
    description: 'List patches for a specific device or site. Exactly one of deviceUid or siteUid must be provided.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUid: { type: 'string', description: 'The unique ID of the device (mutually exclusive with siteUid)' },
        siteUid: { type: 'string', description: 'The unique ID of the site (mutually exclusive with deviceUid)' },
        installStatus: {
          type: 'string',
          enum: ['INSTALLED', 'APPROVED_PENDING', 'NOT_APPROVED'],
          description: 'Filter by patch install status',
        },
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
    },
    handler: (client, args) => auditTools.listPatches(client, args as Parameters<typeof auditTools.listPatches>[1]),
  },

  // ==================== Activity Log Tools ====================
  {
    name: 'rmm_list_activity_logs',
    description: 'List activity logs. Returns last 15 min by default. Pass cursor (next_page from prior response) to page.',
    inputSchema: {
      type: 'object',
      properties: {
        size: { type: 'number' },
        order: { type: 'string', enum: ['asc', 'desc'] },
        from: { type: 'string', description: 'UTC start. Format: YYYY-MM-DDTHH:mm:ssZ' },
        until: { type: 'string', description: 'UTC end. Format: YYYY-MM-DDTHH:mm:ssZ' },
        entity: { type: 'string', enum: ['device', 'user'] },
        categories: { type: 'array', items: { type: 'string' } },
        actions: { type: 'array', items: { type: 'string' } },
        siteIds: { type: 'array', items: { type: 'number' } },
        userIds: { type: 'array', items: { type: 'number' } },
        cursor: { type: 'string', description: 'next_page URL from prior response' },
      },
    },
    handler: (client, args) => activityTools.listActivityLogs(client, args as Parameters<typeof activityTools.listActivityLogs>[1]),
  },

  // ==================== Filter Tools ====================
  {
    name: 'rmm_list_default_filters',
    description: 'List the default device filters',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
    },
    handler: (client, args) => filterTools.listDefaultFilters(client, args as Parameters<typeof filterTools.listDefaultFilters>[1]),
  },
  {
    name: 'rmm_list_custom_filters',
    description: 'List custom device filters created by users',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number' },
        max: { type: 'number', description: 'Results per page' },
      },
    },
    handler: (client, args) => filterTools.listCustomFilters(client, args as Parameters<typeof filterTools.listCustomFilters>[1]),
  },

  // ==================== System Tools ====================
  {
    name: 'rmm_get_system_status',
    description: 'Get the Datto RMM API system status (no auth required)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: (client) => systemTools.getSystemStatus(client),
  },
  {
    name: 'rmm_get_rate_limit',
    description: 'Get the current API rate limit status for your account',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: (client) => systemTools.getRateLimit(client),
  },
  {
    name: 'rmm_get_pagination_config',
    description: 'Get the pagination configuration (default and max page sizes)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: (client) => systemTools.getPaginationConfig(client),
  },

  // ==================== Variable Tools ====================
  {
    name: 'rmm_create_account_variable',
    description: 'Create a new account-level variable',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Variable name' },
        value: { type: 'string', description: 'Variable value' },
        masked: { type: 'boolean', description: 'Whether to mask the value' },
      },
      required: ['name', 'value'],
    },
    handler: (client, args) => variableTools.createAccountVariable(client, args as Parameters<typeof variableTools.createAccountVariable>[1]),
  },
  {
    name: 'rmm_update_account_variable',
    description: 'Update an existing account variable',
    inputSchema: {
      type: 'object',
      properties: {
        variableId: { type: 'number', description: 'The ID of the variable' },
        name: { type: 'string', description: 'New variable name' },
        value: { type: 'string', description: 'New variable value' },
        masked: { type: 'boolean', description: 'Whether to mask the value' },
      },
      required: ['variableId'],
    },
    handler: (client, args) => variableTools.updateAccountVariable(client, args as Parameters<typeof variableTools.updateAccountVariable>[1]),
  },
  {
    name: 'rmm_delete_account_variable',
    description: 'Delete an account variable',
    inputSchema: {
      type: 'object',
      properties: {
        variableId: { type: 'number', description: 'The ID of the variable to delete' },
      },
      required: ['variableId'],
    },
    handler: (client, args) => variableTools.deleteAccountVariable(client, args as Parameters<typeof variableTools.deleteAccountVariable>[1]),
  },
  {
    name: 'rmm_create_site_variable',
    description: 'Create a new variable for a specific site',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
        name: { type: 'string', description: 'Variable name' },
        value: { type: 'string', description: 'Variable value' },
        masked: { type: 'boolean', description: 'Whether to mask the value' },
      },
      required: ['siteUid', 'name', 'value'],
    },
    handler: (client, args) => variableTools.createSiteVariable(client, args as Parameters<typeof variableTools.createSiteVariable>[1]),
  },
  {
    name: 'rmm_update_site_variable',
    description: 'Update an existing site variable',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
        variableId: { type: 'number', description: 'The ID of the variable' },
        name: { type: 'string', description: 'New variable name' },
        value: { type: 'string', description: 'New variable value' },
        masked: { type: 'boolean', description: 'Whether to mask the value' },
      },
      required: ['siteUid', 'variableId'],
    },
    handler: (client, args) => variableTools.updateSiteVariable(client, args as Parameters<typeof variableTools.updateSiteVariable>[1]),
  },
  {
    name: 'rmm_delete_site_variable',
    description: 'Delete a site variable',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
        variableId: { type: 'number', description: 'The ID of the variable to delete' },
      },
      required: ['siteUid', 'variableId'],
    },
    handler: (client, args) => variableTools.deleteSiteVariable(client, args as Parameters<typeof variableTools.deleteSiteVariable>[1]),
  },
  {
    name: 'rmm_update_site_proxy',
    description: 'Configure proxy settings for a site',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
        type: { type: 'string', enum: ['http', 'socks4', 'socks5'], description: 'Proxy type' },
        host: { type: 'string', description: 'Proxy host' },
        port: { type: 'number', description: 'Proxy port' },
        username: { type: 'string', description: 'Proxy username (optional)' },
        password: { type: 'string', description: 'Proxy password (optional)' },
      },
      required: ['siteUid', 'type', 'host', 'port'],
    },
    handler: (client, args) => variableTools.updateSiteProxy(client, args as Parameters<typeof variableTools.updateSiteProxy>[1]),
  },
  {
    name: 'rmm_delete_site_proxy',
    description: 'Remove proxy settings from a site',
    inputSchema: {
      type: 'object',
      properties: {
        siteUid: { type: 'string', description: 'The unique ID of the site' },
      },
      required: ['siteUid'],
    },
    handler: (client, args) => variableTools.deleteSiteProxy(client, args as Parameters<typeof variableTools.deleteSiteProxy>[1]),
  },
];

/**
 * Get a tool by name.
 */
export function getTool(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}

// Core tool names (always loaded — 13 composite + rmm_load_tools)
export const CORE_TOOL_NAMES = new Set<string>([
  'rmm_get_account_dashboard',
  'rmm_find_sites_with_issues',
  'rmm_search_devices',
  'rmm_get_site_health',
  'rmm_get_device_health',
  'rmm_diagnose_device_issue',
  'rmm_investigate_alert',
  'rmm_get_alert_summary',
  'rmm_list_site_devices',
  'rmm_get_site_alerts',
  'rmm_run_site_component',
  'rmm_bulk_update_site_devices',
  'rmm_get_account_analytics',
  'rmm_load_tools',
]);

// Lazy group membership — maps group name to the tool names it contains
export const LAZY_TOOL_GROUPS: Record<string, string[]> = {
  account: [
    'rmm_get_account', 'rmm_list_sites', 'rmm_list_devices', 'rmm_list_users',
    'rmm_list_account_variables', 'rmm_list_components', 'rmm_list_alerts',
    'rmm_get_api_metering_summary',
  ],
  sites: [
    'rmm_get_site', 'rmm_list_site_variables', 'rmm_get_site_settings',
    'rmm_list_site_filters', 'rmm_create_site', 'rmm_update_site',
    'rmm_update_site_proxy', 'rmm_delete_site_proxy',
  ],
  devices: [
    'rmm_get_device', 'rmm_get_device_by_id', 'rmm_get_device_by_mac',
    'rmm_move_device', 'rmm_run_job', 'rmm_set_device_udf', 'rmm_set_device_warranty',
  ],
  alerts: ['rmm_get_alert', 'rmm_resolve_alert'],
  jobs: ['rmm_get_job', 'rmm_get_job_components', 'rmm_get_job_status'],
  audit: ['rmm_get_device_audit', 'rmm_get_device_software', 'rmm_get_device_audit_by_mac', 'rmm_list_patches'],
  activity: ['rmm_list_activity_logs'],
  filters: ['rmm_list_default_filters', 'rmm_list_custom_filters'],
  system: ['rmm_get_system_status', 'rmm_get_rate_limit', 'rmm_get_pagination_config'],
  variables: [
    'rmm_create_account_variable', 'rmm_update_account_variable', 'rmm_delete_account_variable',
    'rmm_create_site_variable', 'rmm_update_site_variable', 'rmm_delete_site_variable',
  ],
};

// Reverse lookup: tool name → group name
const _toolGroupMap: Record<string, string> = {};
for (const [group, names] of Object.entries(LAZY_TOOL_GROUPS)) {
  for (const name of names) {
    _toolGroupMap[name] = group;
  }
}

/** Returns the lazy group name for a tool, or null if it's in the core group. */
export function getToolGroup(name: string): string | null {
  return _toolGroupMap[name] ?? null;
}
