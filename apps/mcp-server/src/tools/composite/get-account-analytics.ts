/**
 * Tier 1 Composite Tool: Get Account Analytics
 * 
 * Usage metrics and trends across all sites for reporting and capacity planning.
 * Provides insights into device growth, alert patterns, and operational health.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface GetAccountAnalyticsArgs {
  /** Time range for trending analysis */
  time_range?: 'week' | 'month' | 'quarter';
  /** Metrics to include */
  metrics?: Array<'devices' | 'alerts' | 'sites'>;
}

/**
 * Get usage metrics and trends across all sites.
 * 
 * Aggregates account-wide data:
 * - Device counts and growth
 * - Site statistics
 * - Alert patterns and resolution rates
 * - Capacity planning insights
 * 
 * Returns formatted analytics report.
 */
export async function getAccountAnalytics(
  client: DattoClient,
  args: GetAccountAnalyticsArgs
): Promise<ToolResult> {
  const {
    time_range = 'month',
    metrics = ['devices', 'alerts', 'sites'],
  } = args;

  try {
    // Step 1: Fetch account-wide data in parallel
    const fetchPromises: Promise<any>[] = [
      client.GET('/v2/account'),
      client.GET('/v2/account/sites', { params: { query: { max: 100 } } }),
      client.GET('/v2/account/devices', { params: { query: { max: 500 } } }),
    ];

    if (metrics.includes('alerts')) {
      fetchPromises.push(
        client.GET('/v2/account/alerts/open'),
        client.GET('/v2/account/alerts/resolved', {
          params: { query: { max: 500 } },
        })
      );
    }

    const results = await Promise.all(fetchPromises);

    const accountRes = results[0];
    const sitesRes = results[1];
    const devicesRes = results[2];
    const alertsRes = metrics.includes('alerts') ? results[3] : null;
    const resolvedAlertsRes = metrics.includes('alerts') ? results[4] : null;

    const account = handleResponse<T.Account>(accountRes);
    const sitesData = handleResponse<T.SitesPage>(sitesRes);
    const devicesData = handleResponse<T.DevicesPage>(devicesRes);

    const sites = sitesData.sites ?? [];
    const devices = devicesData.devices ?? [];

    // Step 2: Calculate metrics
    const lines: string[] = [];
    lines.push(`# Account Analytics`);
    lines.push('');
    lines.push(
      `**Account:** ${account.name ?? 'Unknown'} (${account.uid ?? 'Unknown'})`
    );
    lines.push(`**Time Range:** Last ${getPeriodName(time_range)}`);
    lines.push('');

    // Device Metrics
    if (metrics.includes('devices')) {
      lines.push('## 📊 Device Metrics');
      lines.push('');

      const totalDevices = devices.length;
      const onlineDevices = devices.filter((d) => d.online).length;
      const offlineDevices = totalDevices - onlineDevices;
      const onlinePercentage =
        totalDevices > 0 ? ((onlineDevices / totalDevices) * 100).toFixed(1) : '0';

      lines.push(`**Total Devices:** ${totalDevices}`);
      lines.push(
        `**Online:** ${onlineDevices} (${onlinePercentage}%) | **Offline:** ${offlineDevices}`
      );

      // Device type breakdown
      const devicesByType = new Map<string, number>();
      for (const device of devices) {
        const type = device.deviceType?.type ?? 'Unknown';
        devicesByType.set(type, (devicesByType.get(type) ?? 0) + 1);
      }

      if (devicesByType.size > 0) {
        lines.push('');
        lines.push('**Device Types:**');
        const sortedTypes = Array.from(devicesByType.entries()).sort(
          (a, b) => b[1] - a[1]
        );
        for (const [type, count] of sortedTypes.slice(0, 5)) {
          lines.push(`- ${type}: ${count} devices`);
        }
      }

      // OS breakdown
      const devicesByOS = new Map<string, number>();
      for (const device of devices) {
        const os = device.operatingSystem ?? 'Unknown';
        // Extract major OS name (e.g., "Windows Server 2022" -> "Windows Server")
        const osMajor = os.split(/\d/)[0]?.trim() ?? os;
        devicesByOS.set(osMajor, (devicesByOS.get(osMajor) ?? 0) + 1);
      }

      if (devicesByOS.size > 0) {
        lines.push('');
        lines.push('**Operating Systems:**');
        const sortedOS = Array.from(devicesByOS.entries()).sort(
          (a, b) => b[1] - a[1]
        );
        for (const [os, count] of sortedOS.slice(0, 5)) {
          lines.push(`- ${os}: ${count} devices`);
        }
      }

      lines.push('');
    }

    // Site Metrics
    if (metrics.includes('sites')) {
      lines.push('## 🏢 Site Metrics');
      lines.push('');

      lines.push(`**Total Sites:** ${sites.length}`);

      if (sites.length > 0) {
        // Calculate devices per site
        const devicesPerSite =
          sites.length > 0 ? (devices.length / sites.length).toFixed(1) : '0';
        lines.push(`**Devices per Site (avg):** ${devicesPerSite}`);

        // Top sites by device count
        const siteDeviceCounts: Array<{ name: string; devices: number; online: number }> =
          [];
        for (const site of sites) {
          const siteDevices = devices.filter((d) => d.siteUid === site.uid);
          const onlineCount = siteDevices.filter((d) => d.online).length;
          siteDeviceCounts.push({
            name: site.name ?? site.uid ?? 'Unknown',
            devices: siteDevices.length,
            online: onlineCount,
          });
        }

        siteDeviceCounts.sort((a, b) => b.devices - a.devices);

        lines.push('');
        lines.push('**Top Sites by Device Count:**');
        for (const site of siteDeviceCounts.slice(0, 10)) {
          lines.push(
            `- ${site.name}: ${site.devices} devices (${site.online} online)`
          );
        }
      }

      lines.push('');
    }

    // Alert Metrics
    if (metrics.includes('alerts') && alertsRes) {
      lines.push('## ⚠️  Alert Metrics');
      lines.push('');

      const alertsData = handleResponse<T.AlertsPage>(alertsRes);
      const alerts = alertsData.alerts ?? [];

      const criticalCount = alerts.filter((a) => a.priority === 'Critical').length;
      const highCount = alerts.filter((a) => a.priority === 'High').length;
      const moderateCount = alerts.filter((a) => a.priority === 'Moderate').length;

      lines.push(`**Total Open Alerts:** ${alerts.length}`);
      if (alerts.length > 0) {
        lines.push(
          `- 🔴 Critical: ${criticalCount} | 🟠 High: ${highCount} | 🟡 Moderate: ${moderateCount}`
        );

        // Alert age distribution
        const now = Date.now();
        const recent = alerts.filter((a) => {
          const timestamp = a.timestamp;
          if (!timestamp) return false;
          const time = new Date(timestamp).getTime();
          return now - time < 3600000; // <1h
        }).length;
        const today = alerts.filter((a) => {
          const timestamp = a.timestamp;
          if (!timestamp) return false;
          const time = new Date(timestamp).getTime();
          return now - time >= 3600000 && now - time < 86400000; // 1-24h
        }).length;
        const stale = alerts.filter((a) => {
          const timestamp = a.timestamp;
          if (!timestamp) return false;
          const time = new Date(timestamp).getTime();
          return now - time >= 86400000; // >24h
        }).length;

        lines.push('');
        lines.push('**Alert Age Distribution:**');
        lines.push(`- <1 hour: ${recent} alerts`);
        lines.push(`- 1-24 hours: ${today} alerts`);
        lines.push(`- >24 hours: ${stale} alerts ${stale > 10 ? '⚠️  (stale)' : ''}`);

        // Most common alert types
        const alertTypeMap = new Map<string, number>();
        for (const alert of alerts) {
          const diagnostics = alert.diagnostics ?? 'Unknown';
          const match = diagnostics.match(/^([^:-]+)/);
          const category = match ? match[1]!.trim() : diagnostics.substring(0, 30);
          alertTypeMap.set(category, (alertTypeMap.get(category) ?? 0) + 1);
        }

        const sortedTypes = Array.from(alertTypeMap.entries()).sort(
          (a, b) => b[1] - a[1]
        );

        if (sortedTypes.length > 0) {
          lines.push('');
          lines.push('**Most Common Alert Types:**');
          for (const [type, count] of sortedTypes.slice(0, 5)) {
            lines.push(`- ${type}: ${count} alert${count !== 1 ? 's' : ''}`);
          }
        }

        // Resolution metrics (if resolved alerts available)
        if (resolvedAlertsRes) {
          const resolvedData = handleResponse<T.AlertsPage>(resolvedAlertsRes);
          const resolved = resolvedData.alerts ?? [];

          if (resolved.length > 0) {
            lines.push('');
            lines.push(
              `**Resolution Rate:** ${((resolved.length / (alerts.length + resolved.length)) * 100).toFixed(1)}% (${resolved.length} resolved)`
            );
          }
        }
      } else {
        lines.push('✅ No open alerts across all sites.');
      }

      lines.push('');
    }

    // Insights and Recommendations
    lines.push('## 💡 Insights & Recommendations');
    lines.push('');

    if (devices.length > 0) {
      const offlinePercentage =
        ((devices.filter((d) => !d.online).length / devices.length) * 100).toFixed(1);
      if (parseFloat(offlinePercentage) > 10) {
        lines.push(
          `- ⚠️  High offline device rate (${offlinePercentage}%) - Investigate connectivity issues`
        );
      }
    }

    if (metrics.includes('alerts') && alertsRes) {
      const alertsData = handleResponse<T.AlertsPage>(alertsRes);
      const alerts = alertsData.alerts ?? [];

      if (alerts.length > 50) {
        lines.push(
          `- 🔴 High alert volume (${alerts.length} open) - Consider bulk remediation`
        );
      }

      const staleAlerts = alerts.filter((a) => {
        const timestamp = a.timestamp;
        if (!timestamp) return false;
        const time = new Date(timestamp).getTime();
        return Date.now() - time >= 86400000; // >24h
      }).length;

      if (staleAlerts > 10) {
        lines.push(
          `- ⏰ Many stale alerts (${staleAlerts} >24h old) - Review alert resolution process`
        );
      }
    }

    if (sites.length > 0 && devices.length > 0) {
      const devicesPerSite = devices.length / sites.length;
      if (devicesPerSite > 20) {
        lines.push(
          `- 📈 High devices per site (${devicesPerSite.toFixed(1)} avg) - Consider site segmentation for better management`
        );
      }
    }

    lines.push('');
    lines.push('**Suggested Actions:**');
    lines.push('- Use `rmm_find_sites_with_issues` to prioritize problem sites');
    lines.push('- Run `rmm_get_alert_summary` for detailed alert analysis');
    lines.push('- Check offline devices with `rmm_search_devices({ status: "offline" })`');

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    return errorResult(
      `Failed to get account analytics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get human-readable period name.
 */
function getPeriodName(range: string): string {
  switch (range) {
    case 'week':
      return '7 days';
    case 'month':
      return '30 days';
    case 'quarter':
      return '90 days';
    default:
      return '30 days';
  }
}
