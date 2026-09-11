/**
 * Tier 1 Composite Tool: Account Dashboard
 *
 * High-level account overview for start-of-day triage.
 * Shows what needs attention across all sites.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface GetAccountDashboardArgs {
  /** Time range for activity metrics */
  time_range?: 'today' | 'week' | 'month';
}

/**
 * Get account dashboard with prioritized issues.
 *
 * Aggregates data from multiple endpoints:
 * - Account info (device counts)
 * - All sites (to rank by issues)
 * - Open alerts (to identify problem areas)
 *
 * Returns prioritized list of sites needing attention.
 */
export async function getAccountDashboard(
  client: DattoClient,
  args: GetAccountDashboardArgs
): Promise<ToolResult> {
  const { time_range = 'today' } = args;

  try {
    const [accountRes, sitesRes, alertsRes] = await Promise.all([
      client.GET('/v2/account'),
      client.GET('/v2/account/sites', {
        params: { query: { max: 250 } },
      }),
      client.GET('/v2/account/alerts/open', {
        params: { query: { max: 250 } },
      }),
    ]);

    const account = handleResponse<T.Account>(accountRes);
    const sitesData = handleResponse<T.SitesPage>(sitesRes);
    const alertsData = handleResponse<T.AlertsPage>(alertsRes);

    const sites = sitesData.sites ?? [];
    const alerts = alertsData.alerts ?? [];

    // Aggregate alert counts by site
    const alertsBySite = new Map<string, { critical: number; warning: number; total: number }>();
    for (const alert of alerts) {
      const siteUid = alert.alertSourceInfo?.siteUid || 'unknown';
      const current = alertsBySite.get(siteUid) || { critical: 0, warning: 0, total: 0 };
      if (alert.priority === 'Critical') {
        current.critical++;
      } else if (alert.priority === 'High' || alert.priority === 'Moderate') {
        current.warning++;
      }
      current.total++;
      alertsBySite.set(siteUid, current);
    }

    // Calculate site issue scores
    const siteIssues = sites.map((site) => {
      const siteAlerts = alertsBySite.get(site.uid || '') || { critical: 0, warning: 0, total: 0 };
      const offlineDevices = site.devicesStatus?.numberOfOfflineDevices ?? 0;
      const score = siteAlerts.critical * 10 + siteAlerts.warning * 2 + offlineDevices * 3;
      return {
        name: site.name ?? 'Unknown Site',
        uid: site.uid ?? '',
        alertCount: siteAlerts.total,
        offlineDevices,
        score,
      };
    });

    const sitesWithIssues = siteIssues
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const criticalCount = alerts.filter((a) => a.priority === 'Critical').length;
    const warningCount = alerts.filter(
      (a) => a.priority === 'High' || a.priority === 'Moderate'
    ).length;

    const recommendations: string[] = [];
    if (sitesWithIssues.length > 0 && sitesWithIssues[0]) {
      recommendations.push(
        `Investigate top site: use rmm_get_site_health on ${sitesWithIssues[0].name} (${sitesWithIssues[0].uid})`
      );
      if (sitesWithIssues.length > 1) {
        recommendations.push('Review other problem sites: use rmm_find_sites_with_issues for full list');
      }
      if (criticalCount > 5) {
        recommendations.push('Alert trending: use rmm_get_alert_summary to identify patterns');
      }
    } else {
      recommendations.push('Check for maintenance tasks with rmm_get_account_analytics');
      recommendations.push('Review resolved alerts for trends');
    }

    return successResponse({
      data: {
        timeRange: time_range,
        account: {
          name: account.name ?? 'Datto RMM',
          uid: account.uid ?? '',
          totalDevices: account.devicesStatus?.numberOfDevices ?? 0,
          onlineDevices: account.devicesStatus?.numberOfOnlineDevices ?? 0,
          offlineDevices: account.devicesStatus?.numberOfOfflineDevices ?? 0,
        },
        sitesWithIssues,
        alertSummary: {
          total: alerts.length,
          critical: criticalCount,
          warning: warningCount,
        },
        recommendations,
      },
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
