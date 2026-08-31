/**
 * Tier 1 Composite Tool: Get Site Alerts
 *
 * Alert overview for a specific site with grouping and analysis.
 * Helps identify patterns and prioritize remediation.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
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
 */
export async function getSiteAlerts(
  client: DattoClient,
  args: GetSiteAlertsArgs
): Promise<ToolResult> {
  const { site, severity = 'all', group_by = 'type' } = args;

  try {
    // Resolve site
    let siteUid: string | null = null;

    if (site.match(/^[a-zA-Z0-9-]{20,}$/)) {
      siteUid = site;
    } else {
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
      }
    }

    if (!siteUid) {
      return errorResponse({
        error: 'entity_not_found',
        detail: `Site not found: "${site}". Try searching by exact name or UID.`,
        code: 404,
      });
    }

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

    const deviceMap = new Map<string, T.Device>();
    for (const device of devices) {
      if (device.uid) {
        deviceMap.set(device.uid, device);
      }
    }

    // Apply severity filter
    if (severity !== 'all') {
      alerts = alerts.filter((a) => {
        if (severity === 'critical') {
          return a.priority === 'Critical';
        } else {
          return a.priority === 'High' || a.priority === 'Moderate' || a.priority === 'Low';
        }
      });
    }

    const criticalCount = alerts.filter((a) => a.priority === 'Critical').length;
    const warningCount = alerts.filter(
      (a) => a.priority === 'High' || a.priority === 'Moderate'
    ).length;

    // Build groups
    type AlertGroup = { key: string; alerts: T.Alert[] };
    const groupMap = new Map<string, T.Alert[]>();

    if (group_by === 'device') {
      for (const alert of alerts) {
        const deviceUid = alert.alertSourceInfo?.deviceUid ?? 'unknown';
        const device = deviceMap.get(deviceUid);
        const key = device?.hostname ?? alert.alertSourceInfo?.deviceName ?? deviceUid;
        const existing = groupMap.get(key) ?? [];
        existing.push(alert);
        groupMap.set(key, existing);
      }
    } else {
      for (const alert of alerts) {
        const diagnostics = alert.diagnostics ?? 'Unknown';
        const match = diagnostics.match(/^([^:-]+)/);
        const key = match ? match[1]!.trim() : diagnostics.substring(0, 30);
        const existing = groupMap.get(key) ?? [];
        existing.push(alert);
        groupMap.set(key, existing);
      }
    }

    const groups: AlertGroup[] = Array.from(groupMap.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, groupAlerts]) => ({ key, alerts: groupAlerts }));

    return successResponse({
      data: {
        total: alerts.length,
        critical: criticalCount,
        warning: warningCount,
        groups,
      },
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
