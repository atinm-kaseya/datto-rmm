/**
 * Tier 1 Composite Tool: List Site Devices
 * 
 * Browse and filter devices within a site.
 * Supports filtering by status, type, and alert presence.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface ListSiteDevicesArgs {
  /** Site identifier: name or UID */
  site: string;
  /** Filter by online status */
  status?: 'online' | 'offline' | 'all';
  /** Filter by device type (desktop, laptop, server, etc.) */
  type?: string;
  /** Only show devices with open alerts */
  has_alerts?: boolean;
  /** Sort order */
  sort_by?: 'name' | 'alerts' | 'last_seen';
}

/**
 * List and filter devices within a site.
 * 
 * Supports multiple filter criteria:
 * - Online/offline status
 * - Device type
 * - Presence of alerts
 * 
 * Returns formatted device list with health indicators.
 */
export async function listSiteDevices(
  client: DattoClient,
  args: ListSiteDevicesArgs
): Promise<ToolResult> {
  const {
    site,
    status = 'all',
    type,
    has_alerts = false,
    sort_by = 'name',
  } = args;

  try {
    // Step 1: Resolve site by name or UID
    let siteUid: string | null = null;
    let siteName: string | null = null;

    // Check if it's a UID (alphanumeric, 20+ chars)
    if (site.match(/^[a-zA-Z0-9-]{20,}$/)) {
      siteUid = site;
      const siteRes = await client.GET('/v2/site/{siteUid}', {
        params: { path: { siteUid: site } },
      });
      siteName = (siteRes.data as any)?.name ?? null;
    } else {
      // Search by name
      const sitesRes = await client.GET('/v2/account/sites', {
        params: { query: { max: 50 } },
      });
      const sitesData = handleResponse<T.SitesPage>(sitesRes);
      const sites = sitesData.sites ?? [];
      const match = sites.find(
        (s) => s.name?.toLowerCase() === site.toLowerCase()
      );

      if (match) {
        siteUid = match.uid ?? null;
        siteName = match.name ?? null;
      }
    }

    if (!siteUid) {
      return errorResult(
        `Site not found: "${site}". Try searching by exact name or UID.`
      );
    }

    // Step 2: Fetch devices and optionally alerts
    const fetchPromises: Promise<any>[] = [
      client.GET('/v2/site/{siteUid}/devices', {
        params: {
          path: { siteUid },
          query: { max: 100 },
        },
      }),
    ];

    if (has_alerts) {
      fetchPromises.push(
        client.GET('/v2/site/{siteUid}/alerts/open', {
          params: { path: { siteUid } },
        })
      );
    }

    const results = await Promise.all(fetchPromises);
    const devicesRes = results[0];
    const alertsRes = has_alerts ? results[1] : null;

    const devicesData = handleResponse<T.DevicesPage>(devicesRes);
    let devices = devicesData.devices ?? [];

    // Build alert count map if needed
    let alertCounts = new Map<string, number>();
    if (alertsRes) {
      const alertsData = handleResponse<T.AlertsPage>(alertsRes);
      const alerts = alertsData.alerts ?? [];

      for (const alert of alerts) {
        const deviceUid = alert.alertSourceInfo?.deviceUid;
        if (deviceUid) {
          alertCounts.set(deviceUid, (alertCounts.get(deviceUid) ?? 0) + 1);
        }
      }
    }

    // Step 3: Apply filters
    if (status !== 'all') {
      const isOnline = status === 'online';
      devices = devices.filter((d) => d.online === isOnline);
    }

    if (type) {
      const typeFilter = type.toLowerCase();
      devices = devices.filter(
        (d) => d.deviceType?.type?.toLowerCase().includes(typeFilter)
      );
    }

    if (has_alerts) {
      devices = devices.filter((d) => (d.uid ? alertCounts.get(d.uid) : 0) ?? 0 > 0);
    }

    // Step 4: Sort devices
    if (sort_by === 'alerts') {
      devices.sort((a, b) => {
        const aCount = (a.uid ? alertCounts.get(a.uid) : 0) ?? 0;
        const bCount = (b.uid ? alertCounts.get(b.uid) : 0) ?? 0;
        return bCount - aCount; // Descending
      });
    } else if (sort_by === 'last_seen') {
      devices.sort((a, b) => {
        const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return bTime - aTime; // Most recent first
      });
    } else {
      // sort_by === 'name'
      devices.sort((a, b) => {
        const aName = a.hostname ?? '';
        const bName = b.hostname ?? '';
        return aName.localeCompare(bName);
      });
    }

    // Step 5: Build response
    const lines: string[] = [];
    lines.push(`# Devices: ${siteName ?? siteUid}`);
    lines.push('');

    if (devices.length === 0) {
      lines.push('No devices found matching the specified filters.');
      lines.push('');
      lines.push('💡 **Try:**');
      lines.push('- Remove filters to see all devices');
      lines.push('- Check if the site has any devices registered');

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    }

    lines.push(`Found **${devices.length}** device${devices.length !== 1 ? 's' : ''}`);

    // Add filter summary
    const filters: string[] = [];
    if (status !== 'all') filters.push(`Status: ${status}`);
    if (type) filters.push(`Type: ${type}`);
    if (has_alerts) filters.push('Has alerts');
    if (filters.length > 0) {
      lines.push(`Filters: ${filters.join(', ')}`);
    }
    lines.push('');

    // List devices
    for (const device of devices) {
      const statusIcon = device.online ? '🟢' : '🔴';
      const hostname = device.hostname ?? 'Unknown';
      const deviceType = device.deviceType?.type ?? 'Unknown';
      const os = device.operatingSystem ?? 'Unknown OS';
      const ip = device.intIpAddress ?? device.extIpAddress ?? 'No IP';

      lines.push(`### ${statusIcon} ${hostname}`);
      lines.push(`**Type:** ${deviceType} | **OS:** ${os}`);
      lines.push(`**IP:** ${ip}`);

      if (!device.online && device.lastSeen) {
        const lastSeen = new Date(device.lastSeen);
        const hoursAgo = Math.floor((Date.now() - lastSeen.getTime()) / 3600000);
        lines.push(`**Last Seen:** ${hoursAgo}h ago`);
      }

      // Alert summary
      const alertCount = device.uid ? alertCounts.get(device.uid) ?? 0 : 0;
      if (alertCount > 0) {
        lines.push(`🔴 **${alertCount} open alert${alertCount !== 1 ? 's' : ''}**`);
      } else {
        lines.push('✅ No open alerts');
      }

      lines.push(`**Device UID:** \`${device.uid ?? 'Unknown'}\``);
      lines.push('');
    }

    // Recommendations
    lines.push('---');
    lines.push('');
    lines.push('## 💡 Next Steps');
    lines.push('');

    const offlineDevices = devices.filter((d) => !d.online);
    const devicesWithAlerts = devices.filter(
      (d) => (d.uid ? alertCounts.get(d.uid) ?? 0 : 0) > 0
    );

    if (offlineDevices.length > 0) {
      const firstOffline = offlineDevices[0];
      lines.push(
        `- Investigate offline devices: \`get-device-health({ device: "${firstOffline?.hostname}", site: "${site}" })\``
      );
    }

    if (devicesWithAlerts.length > 0) {
      const topDevice = devices.reduce((prev, curr) => {
        const prevCount = prev.uid ? alertCounts.get(prev.uid) ?? 0 : 0;
        const currCount = curr.uid ? alertCounts.get(curr.uid) ?? 0 : 0;
        return currCount > prevCount ? curr : prev;
      });
      lines.push(
        `- Check device with most alerts: \`get-device-health({ device: "${topDevice.hostname}", site: "${site}" })\``
      );
    }

    if (devices.length > 10) {
      lines.push(`- Review alert overview: \`get-site-alerts({ site: "${site}" })\``);
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    return errorResult(
      `Failed to list site devices: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
