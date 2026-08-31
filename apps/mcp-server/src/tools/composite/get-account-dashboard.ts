/**
 * Tier 1 Composite Tool: Account Dashboard
 * 
 * High-level account overview for start-of-day triage.
 * Shows what needs attention across all sites.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
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
    // Parallel API calls for dashboard data
    const [accountRes, sitesRes, alertsRes] = await Promise.all([
      client.GET('/v2/account'),
      client.GET('/v2/account/sites', {
        params: { query: { max: 250 } }, // Get all sites
      }),
      client.GET('/v2/account/alerts/open', {
        params: { query: { max: 250 } }, // Get all open alerts
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

    // Calculate site issue scores (critical alerts + offline devices)
    interface SiteIssue {
      name: string;
      uid: string;
      criticalAlerts: number;
      warningAlerts: number;
      offlineDevices: number;
      totalDevices: number;
      score: number;
    }

    const siteIssues: SiteIssue[] = sites.map((site) => {
      const siteAlerts = alertsBySite.get(site.uid || '') || { critical: 0, warning: 0, total: 0 };
      const offlineDevices = site.devicesStatus?.numberOfOfflineDevices ?? 0;
      const totalDevices = site.devicesStatus?.numberOfDevices ?? 0;
      
      // Score: critical alerts * 10 + warning alerts * 2 + offline devices * 3
      const score = siteAlerts.critical * 10 + siteAlerts.warning * 2 + offlineDevices * 3;

      return {
        name: site.name ?? 'Unknown Site',
        uid: site.uid ?? '',
        criticalAlerts: siteAlerts.critical,
        warningAlerts: siteAlerts.warning,
        offlineDevices,
        totalDevices,
        score,
      };
    });

    // Sort by score descending and take top 5
    const topSites = siteIssues
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Count alert severities
    const criticalCount = alerts.filter((a) => a.priority === 'Critical').length;
    const warningCount = alerts.filter((a) => a.priority === 'High' || a.priority === 'Moderate').length;

    // Build dashboard response
    const lines: string[] = [];
    
    lines.push(`# Account Dashboard: ${account.name ?? 'Datto RMM'}`);
    lines.push('');
    lines.push(`_Time Range: ${time_range}_`);
    lines.push('');
    
    // Account-wide metrics
    lines.push('## 📊 Account Overview');
    lines.push('');
    lines.push(`**Sites:** ${sites.length}`);
    lines.push(`**Devices:** ${account.devicesStatus?.numberOfDevices ?? 0} total`);
    lines.push(`- 🟢 Online: ${account.devicesStatus?.numberOfOnlineDevices ?? 0}`);
    lines.push(`- 🔴 Offline: ${account.devicesStatus?.numberOfOfflineDevices ?? 0}`);
    lines.push('');
    
    // Alert summary
    lines.push('## ⚠️  Alert Summary');
    lines.push('');
    lines.push(`**Total Open Alerts:** ${alerts.length}`);
    lines.push(`- 🔴 Critical: ${criticalCount}`);
    lines.push(`- ⚠️  Warnings: ${warningCount}`);
    lines.push('');

    // Critical sites
    if (topSites.length > 0) {
      lines.push('## 🚨 Sites Needing Attention');
      lines.push('');
      
      topSites.forEach((site, index) => {
        lines.push(`### ${index + 1}. **${site.name}**`);
        lines.push(`   - Site UID: \`${site.uid}\``);
        
        if (site.criticalAlerts > 0) {
          lines.push(`   - 🔴 ${site.criticalAlerts} critical alert${site.criticalAlerts > 1 ? 's' : ''}`);
        }
        if (site.warningAlerts > 0) {
          lines.push(`   - ⚠️  ${site.warningAlerts} warning${site.warningAlerts > 1 ? 's' : ''}`);
        }
        if (site.offlineDevices > 0) {
          lines.push(`   - 📵 ${site.offlineDevices} offline device${site.offlineDevices > 1 ? 's' : ''}`);
        }
        lines.push(`   - 📊 ${site.totalDevices} total devices`);
        lines.push('');
      });
    } else {
      lines.push('## ✅ All Clear');
      lines.push('');
      lines.push('No critical issues detected across any sites.');
      lines.push('');
    }

    // Recommendations
    lines.push('## 💡 Recommended Actions');
    lines.push('');
    
    if (topSites.length > 0 && topSites[0]) {
      lines.push(`1. **Investigate top site**: Use \`rmm_get_site_health\` on **${topSites[0].name}**`);
      lines.push(`   \`\`\`json`);
      lines.push(`   { "site": "${topSites[0].uid}" }`);
      lines.push(`   \`\`\``);
      lines.push('');
      
      if (topSites.length > 1) {
        lines.push(`2. **Review other problem sites**: Use \`rmm_find_sites_with_issues\` for full list`);
        lines.push('');
      }
      
      if (criticalCount > 5) {
        lines.push(`3. **Alert trending**: Use \`rmm_get_alert_summary\` to identify patterns`);
        lines.push('');
      }
    } else {
      lines.push('- Check for maintenance tasks with \`rmm_get_account_analytics\`');
      lines.push('- Review resolved alerts for trends');
      lines.push('');
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to get account dashboard: ${message}`);
  }
}
