/**
 * Tier 1 Composite Tool: Find Sites With Issues
 *
 * Identifies which sites need attention right now, ranked by severity.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface FindSitesWithIssuesArgs {
  /** Minimum severity level to include */
  severity?: 'critical' | 'warning' | 'all';
  /** Minimum offline device count to include site */
  min_offline_devices?: number;
  /** Sort order for results */
  sort_by?: 'alerts' | 'offline_devices' | 'combined';
  /** Maximum number of sites to return */
  limit?: number;
}

/**
 * Find sites with issues and rank them by severity.
 *
 * Aggregates:
 * - All sites with device counts
 * - Open alerts grouped by site
 * - Alert type distribution per site
 *
 * Returns ranked list of sites needing attention.
 */
export async function findSitesWithIssues(
  client: DattoClient,
  args: FindSitesWithIssuesArgs
): Promise<ToolResult> {
  const {
    severity = 'critical',
    min_offline_devices = 1,
    sort_by = 'combined',
    limit = 10,
  } = args;

  try {
    const [sitesRes, alertsRes] = await Promise.all([
      client.GET('/v2/account/sites', {
        params: { query: { max: 250 } },
      }),
      client.GET('/v2/account/alerts/open', {
        params: { query: { max: 250 } },
      }),
    ]);

    const sitesData = handleResponse<T.SitesPage>(sitesRes);
    const alertsData = handleResponse<T.AlertsPage>(alertsRes);

    const sites = sitesData.sites ?? [];
    const alerts = alertsData.alerts ?? [];

    // Group alerts by site
    interface SiteAlertSummary {
      critical: number;
      warning: number;
      total: number;
    }

    const alertsBySite = new Map<string, SiteAlertSummary>();
    for (const alert of alerts) {
      const siteUid = alert.alertSourceInfo?.siteUid || 'unknown';
      if (!alertsBySite.has(siteUid)) {
        alertsBySite.set(siteUid, { critical: 0, warning: 0, total: 0 });
      }
      const summary = alertsBySite.get(siteUid)!;
      if (alert.priority === 'Critical') {
        summary.critical++;
      } else if (alert.priority === 'High' || alert.priority === 'Moderate') {
        summary.warning++;
      }
      summary.total++;
    }

    // Build site issue list
    interface SiteIssue {
      name: string;
      uid: string;
      alertCount: number;
      offlineDevices: number;
      totalDevices: number;
      score: number;
    }

    const siteIssues: SiteIssue[] = [];

    for (const site of sites) {
      const siteUid = site.uid || '';
      const alertSummary = alertsBySite.get(siteUid) || { critical: 0, warning: 0, total: 0 };
      const offlineDevices = site.devicesStatus?.numberOfOfflineDevices ?? 0;
      const totalDevices = site.devicesStatus?.numberOfDevices ?? 0;

      let includesite = false;
      if (severity === 'critical' && alertSummary.critical > 0) {
        includesite = true;
      } else if (severity === 'warning' && (alertSummary.critical > 0 || alertSummary.warning > 0)) {
        includesite = true;
      } else if (severity === 'all' && (alertSummary.critical > 0 || alertSummary.warning > 0)) {
        includesite = true;
      }

      if (offlineDevices >= min_offline_devices) {
        includesite = true;
      }

      if (!includesite) continue;

      let score = 0;
      if (sort_by === 'alerts' || sort_by === 'combined') {
        score += alertSummary.critical * 10 + alertSummary.warning * 2;
      }
      if (sort_by === 'offline_devices' || sort_by === 'combined') {
        score += offlineDevices * 5;
      }

      siteIssues.push({
        name: site.name ?? 'Unknown Site',
        uid: siteUid,
        alertCount: alertSummary.total,
        offlineDevices,
        totalDevices,
        score,
      });
    }

    siteIssues.sort((a, b) => b.score - a.score);
    const topIssues = siteIssues.slice(0, limit);

    return successResponse({
      data: topIssues,
      count: siteIssues.length,
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
