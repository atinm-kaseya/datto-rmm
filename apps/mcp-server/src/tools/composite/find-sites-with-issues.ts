/**
 * Tier 1 Composite Tool: Find Sites With Issues
 * 
 * Identifies which sites need attention right now, ranked by severity.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
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
    // Fetch sites and alerts in parallel
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
      types: Map<string, number>;
    }

    const alertsBySite = new Map<string, SiteAlertSummary>();
    for (const alert of alerts) {
      const siteUid = alert.alertSourceInfo?.siteUid || 'unknown';
      
      if (!alertsBySite.has(siteUid)) {
        alertsBySite.set(siteUid, {
          critical: 0,
          warning: 0,
          types: new Map(),
        });
      }
      
      const summary = alertsBySite.get(siteUid)!;
      
      if (alert.priority === 'Critical') {
        summary.critical++;
      } else if (alert.priority === 'High' || alert.priority === 'Moderate') {
        summary.warning++;
      }
      
      // Track alert types from diagnostics message
      const alertType = alert.diagnostics?.split(':')[0] || alert.priority || 'Unknown';
      summary.types.set(alertType, (summary.types.get(alertType) || 0) + 1);
    }

    // Build site issue list
    interface SiteIssue {
      name: string;
      uid: string;
      criticalAlerts: number;
      warningAlerts: number;
      offlineDevices: number;
      totalDevices: number;
      topAlertTypes: Array<{ type: string; count: number }>;
      score: number;
    }

    const siteIssues: SiteIssue[] = [];

    for (const site of sites) {
      const siteUid = site.uid || '';
      const alertSummary = alertsBySite.get(siteUid) || { critical: 0, warning: 0, types: new Map() };
      const offlineDevices = site.devicesStatus?.numberOfOfflineDevices ?? 0;
      const totalDevices = site.devicesStatus?.numberOfDevices ?? 0;

      // Filter by severity
      let includesite = false;
      if (severity === 'critical' && alertSummary.critical > 0) {
        includesite = true;
      } else if (severity === 'warning' && (alertSummary.critical > 0 || alertSummary.warning > 0)) {
        includesite = true;
      } else if (severity === 'all' && (alertSummary.critical > 0 || alertSummary.warning > 0)) {
        includesite = true;
      }

      // Filter by offline devices
      if (offlineDevices >= min_offline_devices) {
        includesite = true;
      }

      if (!includesite) continue;

      // Calculate score for sorting
      let score = 0;
      if (sort_by === 'alerts' || sort_by === 'combined') {
        score += alertSummary.critical * 10 + alertSummary.warning * 2;
      }
      if (sort_by === 'offline_devices' || sort_by === 'combined') {
        score += offlineDevices * 5;
      }

      // Get top alert types
      const topAlertTypes = Array.from(alertSummary.types.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type, count]) => ({ type, count }));

      siteIssues.push({
        name: site.name ?? 'Unknown Site',
        uid: siteUid,
        criticalAlerts: alertSummary.critical,
        warningAlerts: alertSummary.warning,
        offlineDevices,
        totalDevices,
        topAlertTypes,
        score,
      });
    }

    // Sort and limit
    siteIssues.sort((a, b) => b.score - a.score);
    const topIssues = siteIssues.slice(0, limit);

    // Build response
    const lines: string[] = [];
    
    lines.push(`# Sites With Issues`);
    lines.push('');
    
    if (topIssues.length === 0) {
      lines.push('## ✅ No Issues Found');
      lines.push('');
      lines.push(`No sites match criteria (severity: ${severity}, min offline: ${min_offline_devices})`);
      lines.push('');
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    }

    lines.push(`Found ${siteIssues.length} site${siteIssues.length > 1 ? 's' : ''} with issues (showing top ${topIssues.length})`);
    lines.push('');

    topIssues.forEach((site, index) => {
      lines.push(`## ${index + 1}. **${site.name}**`);
      lines.push('');
      lines.push(`   **Site UID:** \`${site.uid}\``);
      lines.push('');
      
      if (site.criticalAlerts > 0) {
        lines.push(`   - 🔴 **${site.criticalAlerts} critical alert${site.criticalAlerts > 1 ? 's' : ''}**`);
      }
      if (site.warningAlerts > 0) {
        lines.push(`   - ⚠️  ${site.warningAlerts} warning${site.warningAlerts > 1 ? 's' : ''}`);
      }
      if (site.offlineDevices > 0) {
        lines.push(`   - 📵 ${site.offlineDevices} offline device${site.offlineDevices > 1 ? 's' : ''} (of ${site.totalDevices})`);
      }
      
      if (site.topAlertTypes.length > 0) {
        lines.push('');
        lines.push(`   **Common Issues:**`);
        site.topAlertTypes.forEach((alertType) => {
          lines.push(`   - ${alertType.type}: ${alertType.count} alert${alertType.count > 1 ? 's' : ''}`);
        });
      }
      
      lines.push('');
    });

    // Recommendations
    lines.push('## 💡 Recommended Next Steps');
    lines.push('');
    
    if (topIssues.length > 0 && topIssues[0]) {
      lines.push(`1. **Investigate top site**: \`rmm_get_site_health\` on **${topIssues[0].name}**`);
      lines.push(`   \`\`\`json`);
      lines.push(`   { "site": "${topIssues[0].uid}" }`);
      lines.push(`   \`\`\``);
      lines.push('');

      if (topIssues.length > 1) {
        lines.push(`2. **Compare sites**: Use \`rmm_get_site_health\` on other problem sites`);
        lines.push('');
      }

      lines.push(`3. **Alert patterns**: Use \`rmm_get_alert_summary\` for trending analysis`);
      lines.push('');
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to find sites with issues: ${message}`);
  }
}
