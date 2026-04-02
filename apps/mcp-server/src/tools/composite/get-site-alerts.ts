/**
 * Tier 1 Composite Tool: Get Site Alerts
 * 
 * Alert overview for a specific site with grouping and analysis.
 * Helps identify patterns and prioritize remediation.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface GetSiteAlertsArgs {
  /** Site identifier: name or UID */
  site: string;
  /** Filter by severity */
  severity?: 'critical' | 'warning' | 'all';
  /** Group alerts by device or type */
  group_by?: 'device' | 'type';
}

/**
 * Get alert overview for a specific site.
 * 
 * Aggregates alerts with grouping options:
 * - By device: Shows which devices have the most alerts
 * - By type: Shows which alert types are most common
 * 
 * Returns formatted overview with recommendations.
 */
export async function getSiteAlerts(
  client: DattoClient,
  args: GetSiteAlertsArgs
): Promise<ToolResult> {
  const { site, severity = 'all', group_by = 'type' } = args;

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

    // Step 2: Fetch alerts and devices
    const [alertsRes, devicesRes] = await Promise.all([
      client.GET('/v2/site/{siteUid}/alerts/open', {
        params: { path: { siteUid } },
      }),
      client.GET('/v2/site/{siteUid}/devices', {
        params: { path: { siteUid }, query: { max: 100 } },
      }),
    ]);

    const alertsData = handleResponse<T.AlertsPage>(alertsRes);
    let alerts = alertsData.alerts ?? [];

    const devicesData = handleResponse<T.DevicesPage>(devicesRes);
    const devices = devicesData.devices ?? [];

    // Build device lookup map
    const deviceMap = new Map<string, T.Device>();
    for (const device of devices) {
      if (device.uid) {
        deviceMap.set(device.uid, device);
      }
    }

    // Step 3: Apply severity filter
    if (severity !== 'all') {
      const filterPriority = severity === 'critical' ? 'Critical' : 'High';
      alerts = alerts.filter((a) => {
        if (severity === 'critical') {
          return a.priority === 'Critical';
        } else {
          return a.priority === 'High' || a.priority === 'Moderate' || a.priority === 'Low';
        }
      });
    }

    // Step 4: Build response
    const lines: string[] = [];
    lines.push(`# Site Alerts: ${siteName ?? siteUid}`);
    lines.push('');

    if (alerts.length === 0) {
      lines.push('✅ **No open alerts** matching the specified filters.');
      lines.push('');
      lines.push('💡 This site is healthy! Consider checking other sites.');

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    }

    // Count by severity
    const criticalCount = alerts.filter((a) => a.priority === 'Critical').length;
    const highCount = alerts.filter((a) => a.priority === 'High').length;
    const moderateCount = alerts.filter((a) => a.priority === 'Moderate').length;
    const lowCount = alerts.filter((a) => a.priority === 'Low').length;

    lines.push(
      `**Total:** ${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`
    );
    const severitySummary: string[] = [];
    if (criticalCount > 0) severitySummary.push(`🔴 ${criticalCount} critical`);
    if (highCount > 0) severitySummary.push(`🟠 ${highCount} high`);
    if (moderateCount > 0) severitySummary.push(`🟡 ${moderateCount} moderate`);
    if (lowCount > 0) severitySummary.push(`🔵 ${lowCount} low`);
    lines.push(`**Severity:** ${severitySummary.join(', ')}`);
    lines.push('');

    // Group alerts
    if (group_by === 'device') {
      lines.push('## Grouped by Device');
      lines.push('');

      const alertsByDevice = new Map<string, T.Alert[]>();
      for (const alert of alerts) {
        const deviceUid = alert.alertSourceInfo?.deviceUid ?? 'unknown';
        const existing = alertsByDevice.get(deviceUid) ?? [];
        existing.push(alert);
        alertsByDevice.set(deviceUid, existing);
      }

      // Sort by alert count
      const sortedDevices = Array.from(alertsByDevice.entries()).sort(
        (a, b) => b[1].length - a[1].length
      );

      for (const [deviceUid, deviceAlerts] of sortedDevices) {
        const device = deviceMap.get(deviceUid);
        const deviceName =
          device?.hostname ?? deviceAlerts[0]?.alertSourceInfo?.deviceName ?? deviceUid;
        const criticalInDevice = deviceAlerts.filter(
          (a) => a.priority === 'Critical'
        ).length;

        const icon = criticalInDevice > 0 ? '🔴' : '⚠️';
        lines.push(`### ${icon} ${deviceName} (${deviceAlerts.length} alerts)`);

        if (criticalInDevice > 0) {
          lines.push(`- ${criticalInDevice} critical`);
        }

        // List first 3 alerts
        for (const alert of deviceAlerts.slice(0, 3)) {
          const priorityIcon = getPriorityIcon(alert.priority);
          lines.push(`- ${priorityIcon} ${alert.diagnostics ?? 'Unknown issue'}`);
        }

        if (deviceAlerts.length > 3) {
          lines.push(`- _... and ${deviceAlerts.length - 3} more_`);
        }

        lines.push('');
      }
    } else {
      // group_by === 'type'
      lines.push('## Grouped by Alert Type');
      lines.push('');

      const alertsByType = new Map<string, T.Alert[]>();
      for (const alert of alerts) {
        const diagnostics = alert.diagnostics ?? 'Unknown';
        // Extract category (text before colon or first few words)
        const match = diagnostics.match(/^([^:-]+)/);
        const category = match ? match[1]!.trim() : diagnostics.substring(0, 30);

        const existing = alertsByType.get(category) ?? [];
        existing.push(alert);
        alertsByType.set(category, existing);
      }

      // Sort by alert count
      const sortedTypes = Array.from(alertsByType.entries()).sort(
        (a, b) => b[1].length - a[1].length
      );

      for (const [category, typeAlerts] of sortedTypes) {
        const criticalInType = typeAlerts.filter(
          (a) => a.priority === 'Critical'
        ).length;
        const icon = criticalInType > 0 ? '🔴' : '⚠️';

        lines.push(`### ${icon} ${category} (${typeAlerts.length} alert${typeAlerts.length !== 1 ? 's' : ''})`);

        if (criticalInType > 0) {
          lines.push(`- ${criticalInType} critical`);
        }

        // List affected devices
        const affectedDevices = new Set<string>();
        for (const alert of typeAlerts) {
          const deviceUid = alert.alertSourceInfo?.deviceUid;
          if (deviceUid) {
            const device = deviceMap.get(deviceUid);
            affectedDevices.add(device?.hostname ?? deviceUid);
          }
        }

        lines.push(
          `- Affected devices: ${Array.from(affectedDevices).slice(0, 5).join(', ')}${affectedDevices.size > 5 ? `, +${affectedDevices.size - 5} more` : ''}`
        );
        lines.push('');
      }
    }

    // Recommendations
    lines.push('---');
    lines.push('');
    lines.push('## 💡 Recommended Actions');
    lines.push('');

    if (criticalCount > 0) {
      if (group_by === 'type') {
        // Find most common alert type
        const typeCounts = new Map<string, number>();
        for (const alert of alerts) {
          const match = (alert.diagnostics ?? '').match(/^([^:-]+)/);
          const type = match ? match[1]!.trim() : 'Unknown';
          typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
        }
        const topType = Array.from(typeCounts.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0];

        if (topType) {
          lines.push(
            `- Focus on "${topType[0]}" alerts first (most common critical issue)`
          );
        }
      } else {
        const topDevice = Array.from(
          alerts.reduce((map, alert) => {
            const deviceUid = alert.alertSourceInfo?.deviceUid ?? 'unknown';
            map.set(deviceUid, (map.get(deviceUid) ?? 0) + 1);
            return map;
          }, new Map<string, number>())
        ).sort((a, b) => b[1] - a[1])[0];

        if (topDevice) {
          const device = deviceMap.get(topDevice[0]);
          lines.push(
            `- Start with device with most alerts: \`get-device-health({ device: "${device?.hostname ?? topDevice[0]}", site: "${site}" })\``
          );
        }
      }
    }

    lines.push(
      `- Review full site health: \`get-site-health({ site: "${site}" })\``
    );

    if (alerts.length > 20) {
      lines.push(
        '- Consider bulk operations if many devices affected: `bulk-update-site-devices` or `run-site-component`'
      );
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    return errorResult(
      `Failed to get site alerts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get icon for alert priority.
 */
function getPriorityIcon(
  priority?: 'Critical' | 'High' | 'Moderate' | 'Low' | 'Information' | 'Unknown'
): string {
  switch (priority) {
    case 'Critical':
      return '🔴';
    case 'High':
      return '🟠';
    case 'Moderate':
      return '🟡';
    case 'Low':
      return '🔵';
    default:
      return '⚪';
  }
}
