/**
 * Tier 1 Composite Tool: Get Account Analytics
 *
 * Usage metrics and trends across all sites for reporting and capacity planning.
 * Provides insights into device growth, alert patterns, and operational health.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface GetAccountAnalyticsArgs {
  /** Time range for trending analysis */
  time_range?: 'week' | 'month' | 'quarter';
  /** Metrics to include */
  metrics?: Array<'devices' | 'alerts' | 'sites'>;
}

/**
 * Get usage metrics and trends across all sites.
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

    const totalDevices = devices.length;
    const onlineDevices = devices.filter((d) => d.online).length;

    // Device metrics
    let deviceMetrics: Record<string, unknown> = {};
    if (metrics.includes('devices')) {
      const devicesByType = new Map<string, number>();
      for (const device of devices) {
        const type = device.deviceType?.type ?? 'Unknown';
        devicesByType.set(type, (devicesByType.get(type) ?? 0) + 1);
      }

      const devicesByOS = new Map<string, number>();
      for (const device of devices) {
        const os = device.operatingSystem ?? 'Unknown';
        const osMajor = os.split(/\d/)[0]?.trim() ?? os;
        devicesByOS.set(osMajor, (devicesByOS.get(osMajor) ?? 0) + 1);
      }

      deviceMetrics = {
        total: totalDevices,
        online: onlineDevices,
        offline: totalDevices - onlineDevices,
        onlinePercent:
          totalDevices > 0
            ? parseFloat(((onlineDevices / totalDevices) * 100).toFixed(1))
            : 0,
        byType: Object.fromEntries(
          Array.from(devicesByType.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
        ),
        byOs: Object.fromEntries(
          Array.from(devicesByOS.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
        ),
      };
    }

    // Site metrics
    let siteMetrics: Record<string, unknown> = {};
    if (metrics.includes('sites')) {
      const siteDeviceCounts = sites.map((site) => {
        const siteDevices = devices.filter((d) => d.siteUid === site.uid);
        const onlineCount = siteDevices.filter((d) => d.online).length;
        return {
          name: site.name ?? site.uid ?? 'Unknown',
          uid: site.uid ?? null,
          deviceCount: siteDevices.length,
          onlineCount,
        };
      });
      siteDeviceCounts.sort((a, b) => b.deviceCount - a.deviceCount);

      siteMetrics = {
        total: sites.length,
        avgDevicesPerSite:
          sites.length > 0
            ? parseFloat((devices.length / sites.length).toFixed(1))
            : 0,
        topSites: siteDeviceCounts.slice(0, 10),
      };
    }

    // Alert metrics
    let alertMetrics: Record<string, unknown> = {};
    let totalAlerts = 0;
    if (metrics.includes('alerts') && alertsRes) {
      const alertsData = handleResponse<T.AlertsPage>(alertsRes);
      const alerts = alertsData.alerts ?? [];
      totalAlerts = alerts.length;

      const criticalCount = alerts.filter((a) => a.priority === 'Critical').length;
      const highCount = alerts.filter((a) => a.priority === 'High').length;
      const moderateCount = alerts.filter((a) => a.priority === 'Moderate').length;

      const now = Date.now();
      const recent = alerts.filter((a) => {
        if (!a.timestamp) return false;
        return now - new Date(a.timestamp).getTime() < 3600000;
      }).length;
      const today = alerts.filter((a) => {
        if (!a.timestamp) return false;
        const age = now - new Date(a.timestamp).getTime();
        return age >= 3600000 && age < 86400000;
      }).length;
      const stale = alerts.filter((a) => {
        if (!a.timestamp) return false;
        return now - new Date(a.timestamp).getTime() >= 86400000;
      }).length;

      const alertTypeMap = new Map<string, number>();
      for (const alert of alerts) {
        const diagnostics = alert.diagnostics ?? 'Unknown';
        const match = diagnostics.match(/^([^:-]+)/);
        const category = match ? match[1]!.trim() : diagnostics.substring(0, 30);
        alertTypeMap.set(category, (alertTypeMap.get(category) ?? 0) + 1);
      }

      const topTypes = Array.from(alertTypeMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      let resolutionRate: number | null = null;
      if (resolvedAlertsRes) {
        const resolvedData = handleResponse<T.AlertsPage>(resolvedAlertsRes);
        const resolved = resolvedData.alerts ?? [];
        if (resolved.length > 0) {
          resolutionRate = parseFloat(
            ((resolved.length / (alerts.length + resolved.length)) * 100).toFixed(1)
          );
        }
      }

      alertMetrics = {
        total: totalAlerts,
        critical: criticalCount,
        high: highCount,
        moderate: moderateCount,
        ageDistribution: { recent, today, stale },
        topTypes: Object.fromEntries(topTypes),
        resolutionRate,
      };
    }

    return successResponse({
      data: {
        timeRange: time_range,
        account: {
          name: account.name ?? null,
          uid: account.uid ?? null,
        },
        totalSites: sites.length,
        totalDevices,
        onlineDevices,
        totalAlerts,
        metrics: {
          devices: deviceMetrics,
          sites: siteMetrics,
          alerts: alertMetrics,
        },
      },
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
