/**
 * Tier 1 Composite Tool: Get Alert Summary
 *
 * Alert trending and analytics - account-wide or site-filtered.
 * Identifies patterns and most affected devices/sites.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface GetAlertSummaryArgs {
  /** Filter to specific site (optional, account-wide if omitted) */
  site?: string;
  /** Filter by severity */
  severity?: 'critical' | 'warning' | 'all';
  /** Group alerts by dimension */
  group_by?: 'device' | 'type' | 'site';
  /** Time range for analysis */
  time_range?: 'today' | 'week' | 'month';
}

/**
 * Get alert trending and analytics.
 */
export async function getAlertSummary(
  client: DattoClient,
  args: GetAlertSummaryArgs
): Promise<ToolResult> {
  const { site, severity = 'all', group_by = 'type', time_range = 'today' } = args;

  try {
    let siteUid: string | null = null;

    if (site) {
      if (site.match(/^[a-zA-Z0-9-]{20,}$/)) {
        siteUid = site;
      } else {
        const sitesRes = await client.GET('/v2/account/sites', {
          params: { query: { max: 50 } },
        });
        const sitesData = handleResponse<T.SitesPage>(sitesRes);
        const sites = sitesData.sites ?? [];
        const found = sites.find(
          (s) => s.name?.toLowerCase().includes(site.toLowerCase())
        );
        if (found) {
          siteUid = found.uid ?? null;
        }
      }

      if (!siteUid) {
        return errorResponse({
          error: 'entity_not_found',
          detail: `Site not found: "${site}". Try searching by exact name or UID.`,
          code: 404,
        });
      }
    }

    const alertsRes = siteUid
      ? await client.GET('/v2/site/{siteUid}/alerts/open', {
          params: { path: { siteUid }, query: { max: 250 } },
        })
      : await client.GET('/v2/account/alerts/open', {
          params: { query: { max: 250 } },
        });

    const alertsData = handleResponse<T.AlertsPage>(alertsRes);
    let alerts = alertsData.alerts ?? [];

    if (severity === 'critical') {
      alerts = alerts.filter((a) => a.priority === 'Critical');
    } else if (severity === 'warning') {
      alerts = alerts.filter(
        (a) => a.priority === 'High' || a.priority === 'Moderate'
      );
    }

    const criticalCount = alerts.filter((a) => a.priority === 'Critical').length;
    const warningCount = alerts.filter(
      (a) => a.priority === 'High' || a.priority === 'Moderate'
    ).length;

    // Build groups
    const groupMap = new Map<string, T.Alert[]>();

    if (group_by === 'device') {
      for (const alert of alerts) {
        const key = alert.alertSourceInfo?.deviceName ?? 'Unknown Device';
        const existing = groupMap.get(key) ?? [];
        existing.push(alert);
        groupMap.set(key, existing);
      }
    } else if (group_by === 'site') {
      for (const alert of alerts) {
        const key = alert.alertSourceInfo?.siteName ?? 'Unknown Site';
        const existing = groupMap.get(key) ?? [];
        existing.push(alert);
        groupMap.set(key, existing);
      }
    } else {
      // group_by === 'type'
      for (const alert of alerts) {
        const diagnostics = alert.diagnostics ?? 'Unknown';
        const match = diagnostics.match(/^([^:-]+)/);
        const key = match ? match[1]!.trim() : diagnostics.substring(0, 30);
        const existing = groupMap.get(key) ?? [];
        existing.push(alert);
        groupMap.set(key, existing);
      }
    }

    const groups = Array.from(groupMap.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .map(([key, groupAlerts]) => ({
        key,
        count: groupAlerts.length,
        alerts: groupAlerts,
      }));

    return successResponse({
      data: {
        timeRange: time_range,
        scope: site ? (siteUid ?? site) : 'account',
        total: alerts.length,
        critical: criticalCount,
        warning: warningCount,
        groups,
      },
      count: alerts.length,
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
