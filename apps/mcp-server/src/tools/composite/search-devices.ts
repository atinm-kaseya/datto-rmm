/**
 * Tier 1 Composite Tool: Search Devices
 * 
 * Intelligent device search across the account using natural language.
 * No need to know UIDs, filter IDs, or which site contains the device.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface SearchDevicesArgs {
  /** Search query - matches hostname, IP, site name, OS, or device type */
  query?: string;
  /** Filter by online status */
  status?: 'online' | 'offline' | 'all';
  /** Include only devices with open alerts */
  has_alerts?: boolean;
  /** Limit results */
  limit?: number;
}

interface DeviceWithAlerts extends T.Device {
  alertCount?: number;
}

/**
 * Search for devices across the account with intelligent filtering.
 * 
 * Features:
 * - Natural language search across multiple fields
 * - Ranks results by relevance
 * - Includes alert counts and site context
 * - Returns actionable device information
 */
export async function searchDevices(
  client: DattoClient,
  args: SearchDevicesArgs
): Promise<ToolResult> {
  const { query, status = 'all', has_alerts = false, limit = 20 } = args;

  try {
    // Fetch devices
    const params: any = {
      max: Math.min(limit * 2, 250), // Over-fetch for filtering and ranking
    };

    let allDevices: T.Device[] = [];

    if (query) {
      // Try multiple search strategies in parallel
      const searchStrategies = [
        { hostname: query },
        { siteName: query },
        { operatingSystem: query },
      ];

      const results = await Promise.all(
        searchStrategies.map(async (strategy) => {
          try {
            const response = await client.GET('/v2/account/devices', {
              params: { query: { ...params, ...strategy } },
            });
            return handleResponse<T.DevicesPage>(response);
          } catch {
            return { devices: [] };
          }
        })
      );

      // Combine and deduplicate results
      const deviceMap = new Map<string, T.Device>();
      for (const result of results) {
        const devices = result.devices ?? [];
        for (const device of devices) {
          if (device.uid && !deviceMap.has(device.uid)) {
            deviceMap.set(device.uid, device);
          }
        }
      }

      allDevices = Array.from(deviceMap.values());
    } else {
      // No query - get all devices
      const response = await client.GET('/v2/account/devices', {
        params: { query: params },
      });
      const devicesData = handleResponse<T.DevicesPage>(response);
      allDevices = devicesData.devices ?? [];
    }

    // Apply status filter
    if (status !== 'all') {
      const isOnline = status === 'online';
      allDevices = allDevices.filter((d) => d.online === isOnline);
    }

    // Fetch alert information if needed
    let devicesWithAlerts = allDevices;
    
    if (has_alerts) {
      // Filter to only devices with alerts
      devicesWithAlerts = await filterDevicesWithAlerts(client, allDevices);
    }

    // Rank by relevance if there's a query
    if (query) {
      devicesWithAlerts = rankDevicesByRelevance(devicesWithAlerts, query);
    }

    // Limit results
    const finalDevices = devicesWithAlerts.slice(0, limit);

    // Get alert counts for display
    const devicesWithAlertCounts = await enrichWithAlertCounts(client, finalDevices);

    // Format results
    const report = formatSearchResults(devicesWithAlertCounts, { query, status, has_alerts, limit });

    return {
      content: [{ type: 'text' as const, text: report }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Search failed: ${message}`);
  }
}

/**
 * Filter devices to only those with open alerts.
 */
async function filterDevicesWithAlerts(
  client: DattoClient,
  devices: T.Device[]
): Promise<T.Device[]> {
  try {
    // Fetch all open alerts to get device UIDs
    const response = await client.GET('/v2/account/alerts/open', {
      params: { query: { max: 250 } },
    });
    
    const alertsData = handleResponse<T.AlertsPage>(response);
    const alerts = alertsData.alerts ?? [];

    const alertedDeviceUids = new Set(
      alerts
        .map((alert) => alert.alertSourceInfo?.deviceUid)
        .filter((uid): uid is string => uid !== undefined && uid !== null)
    );

    return devices.filter((device) => device.uid && alertedDeviceUids.has(device.uid));
  } catch {
    // If we can't fetch alerts, return all devices
    return devices;
  }
}

/**
 * Add alert counts to devices for context.
 */
async function enrichWithAlertCounts(
  client: DattoClient,
  devices: T.Device[]
): Promise<DeviceWithAlerts[]> {
  // Fetch alert counts in smaller batches to avoid overwhelming API
  const batchSize = 10;
  const enrichedDevices: DeviceWithAlerts[] = [];

  for (let i = 0; i < devices.length; i += batchSize) {
    const batch = devices.slice(i, i + batchSize);
    const alertPromises = batch.map(async (device) => {
      try {
        const response = await client.GET('/v2/device/{deviceUid}/alerts/open', {
          params: { path: { deviceUid: device.uid! }, query: { max: 1 } },
        });
        const alertsData = handleResponse<T.AlertsPage>(response);
        return {
          ...device,
          alertCount: alertsData.pageDetails?.totalCount ?? 0,
        };
      } catch {
        return { ...device, alertCount: 0 };
      }
    });

    const enrichedBatch = await Promise.all(alertPromises);
    enrichedDevices.push(...enrichedBatch);
  }

  return enrichedDevices;
}

/**
 * Rank devices by relevance to search query.
 */
function rankDevicesByRelevance(devices: T.Device[], query: string): T.Device[] {
  const lowerQuery = query.toLowerCase();

  const scored = devices.map((device) => {
    let score = 0;

    // Exact hostname match
    if (device.hostname?.toLowerCase() === lowerQuery) {
      score += 100;
    }
    // Hostname contains query
    else if (device.hostname?.toLowerCase().includes(lowerQuery)) {
      score += 50;
    }

    // Site name match
    if (device.siteName?.toLowerCase().includes(lowerQuery)) {
      score += 30;
    }

    // OS match
    if (device.operatingSystem?.toLowerCase().includes(lowerQuery)) {
      score += 20;
    }

    // IP match
    if (device.intIpAddress?.includes(query) || device.extIpAddress?.includes(query)) {
      score += 40;
    }

    // Boost online devices slightly
    if (device.online) {
      score += 5;
    }

    return { device, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.device);
}

/**
 * Format search results as a readable report.
 */
function formatSearchResults(
  devices: DeviceWithAlerts[],
  filters: {
    query?: string;
    status: string;
    has_alerts: boolean;
    limit: number;
  }
): string {
  const lines: string[] = [];

  // Header
  lines.push('# Device Search Results');
  lines.push('');

  // Filters applied
  const filterDescriptions: string[] = [];
  if (filters.query) filterDescriptions.push(`Query: "${filters.query}"`);
  if (filters.status !== 'all') filterDescriptions.push(`Status: ${filters.status}`);
  if (filters.has_alerts) filterDescriptions.push('With alerts only');

  if (filterDescriptions.length > 0) {
    lines.push(`**Filters:** ${filterDescriptions.join(' • ')}`);
    lines.push('');
  }

  lines.push(`**Found:** ${devices.length} device(s)`);
  lines.push('');

  // Results
  if (devices.length === 0) {
    lines.push('_No devices found matching your criteria._');
    lines.push('');
    lines.push('**Suggestions:**');
    lines.push('- Try a broader search term');
    lines.push('- Remove status filters');
    lines.push('- Check spelling of hostnames or site names');
  } else {
    lines.push('---');
    lines.push('');

    devices.forEach((device, index) => {
      lines.push(`## ${index + 1}. ${device.hostname ?? 'Unknown'}`);
      lines.push('');
      
      // Status badge
      const statusBadge = device.online ? '🟢 Online' : '🔴 Offline';
      lines.push(`**Status:** ${statusBadge}`);
      
      // Basic info
      lines.push(`**Site:** ${device.siteName ?? 'N/A'}`);
      lines.push(`**Type:** ${device.deviceType?.type ?? 'Unknown'}`);
      lines.push(`**OS:** ${device.operatingSystem ?? 'Unknown'}`);
      
      // IPs
      if (device.intIpAddress) {
        lines.push(`**Internal IP:** ${device.intIpAddress}`);
      }
      if (device.extIpAddress) {
        lines.push(`**External IP:** ${device.extIpAddress}`);
      }
      
      // Alerts
      if (device.alertCount !== undefined) {
        if (device.alertCount > 0) {
          lines.push(`**Alerts:** ⚠️  ${device.alertCount} open`);
        } else {
          lines.push(`**Alerts:** ✅ None`);
        }
      }
      
      // UIDs for actions
      lines.push('');
      lines.push(`**Device UID:** \`${device.uid}\``);
      if (device.siteUid) {
        lines.push(`**Site UID:** \`${device.siteUid}\``);
      }
      lines.push('');
    });

    // Footer with action hints
    if (devices.length >= filters.limit) {
      lines.push('---');
      lines.push('');
      lines.push(`_Showing first ${filters.limit} results. Refine your search for more specific results._`);
      lines.push('');
    }

    lines.push('## 💡 Next Steps');
    lines.push('');
    lines.push('- Use `get-device-health` to investigate specific devices');
    lines.push('- Use `get-site-health` to see full site context');
    lines.push('- Use `diagnose-device-issue` for troubleshooting');
  }

  return lines.join('\n');
}
