/**
 * Tier 1 Composite Tool: Get Alert Summary
 * 
 * Alert trending and analytics - account-wide or site-filtered.
 * Identifies patterns and most affected devices/sites.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
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
 * 
 * Aggregates data from multiple endpoints:
 * - Open alerts (account-wide or site-scoped)
 * - Device information for context
 * - Alert patterns and grouping
 */
export async function getAlertSummary(
  client: DattoClient,
  args: GetAlertSummaryArgs
): Promise<ToolResult> {
  const { site, severity = 'all', group_by = 'type', time_range = 'today' } = args;

  try {
    // Step 1: Resolve site if provided
    let siteUid: string | null = null;
    let siteName: string | null = null;

    if (site) {
      // Check if it's a UID
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
        const found = sites.find(
          (s) => s.name?.toLowerCase().includes(site.toLowerCase())
        );
        if (found) {
          siteUid = found.uid ?? null;
          siteName = found.name ?? null;
        }
      }

      if (!siteUid) {
        return errorResult(`Site not found: "${site}". Try searching by exact name or UID.`);
      }
    }

    // Step 2: Fetch alerts
    const alertsRes = siteUid
      ? await client.GET('/v2/site/{siteUid}/alerts/open', {
          params: { path: { siteUid }, query: { max: 250 } },
        })
      : await client.GET('/v2/account/alerts/open', {
          params: { query: { max: 250 } },
        });

    const alertsData = handleResponse<T.AlertsPage>(alertsRes);
    let alerts = alertsData.alerts ?? [];

    // Filter by severity
    if (severity === 'critical') {
      alerts = alerts.filter((a) => a.priority === 'Critical');
    } else if (severity === 'warning') {
      alerts = alerts.filter(
        (a) => a.priority === 'High' || a.priority === 'Moderate'
      );
    }

    // Step 3: Build summary report
    const report = buildAlertSummaryReport({
      alerts,
      siteName,
      siteUid,
      severity,
      group_by,
      time_range,
    });

    return {
      content: [{ type: 'text', text: report }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to generate alert summary: ${message}`);
  }
}

/**
 * Build alert summary report.
 */
function buildAlertSummaryReport(data: {
  alerts: T.Alert[];
  siteName: string | null;
  siteUid: string | null;
  severity: string;
  group_by: string;
  time_range: string;
}): string {
  const { alerts, siteName, siteUid, severity, group_by, time_range } = data;

  const lines: string[] = [];

  // Header
  const scopeText = siteName ? `${siteName}` : 'Account-Wide';
  lines.push(`# Alert Summary: ${scopeText}`);
  lines.push('');
  lines.push(`_Time Range: ${time_range} | Severity: ${severity}_`);
  lines.push('');

  // Overall Stats
  const critical = alerts.filter((a) => a.priority === 'Critical');
  const warnings = alerts.filter((a) => a.priority === 'High' || a.priority === 'Moderate');

  lines.push('## 📊 Overview');
  lines.push('');
  lines.push(`**Total Open Alerts:** ${alerts.length}`);
  lines.push(`- 🔴 Critical: ${critical.length}`);
  lines.push(`- ⚠️  Warnings: ${warnings.length}`);
  lines.push('');

  if (alerts.length === 0) {
    lines.push('## ✅ No Alerts');
    lines.push('');
    lines.push('No alerts match the specified criteria.');
    lines.push('');
    return lines.join('\n');
  }

  // Grouped Analysis
  lines.push(`## 📋 Grouped by ${group_by === 'device' ? 'Device' : group_by === 'type' ? 'Type' : 'Site'}`);
  lines.push('');

  if (group_by === 'type') {
    const grouped = groupAlertsByType(alerts);
    const sorted = Array.from(grouped.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);

    sorted.forEach(([type, typeAlerts], idx) => {
      const criticalCount = typeAlerts.filter((a) => a.priority === 'Critical').length;
      const warningText = criticalCount > 0 ? `, ${criticalCount} critical` : '';
      lines.push(`${idx + 1}. **${type}** - ${typeAlerts.length} alert(s)${warningText}`);
    });
  } else if (group_by === 'device') {
    const grouped = groupAlertsByDevice(alerts);
    const sorted = Array.from(grouped.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);

    sorted.forEach(([device, deviceAlerts], idx) => {
      const criticalCount = deviceAlerts.filter((a) => a.priority === 'Critical').length;
      const warningText = criticalCount > 0 ? ` (${criticalCount} critical)` : '';
      lines.push(`${idx + 1}. **${device}**${warningText} - ${deviceAlerts.length} alert(s)`);
    });
  } else if (group_by === 'site') {
    const grouped = groupAlertsBySite(alerts);
    const sorted = Array.from(grouped.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);

    sorted.forEach(([siteName, siteAlerts], idx) => {
      const criticalCount = siteAlerts.filter((a) => a.priority === 'Critical').length;
      const warningText = criticalCount > 0 ? ` (${criticalCount} critical)` : '';
      lines.push(`${idx + 1}. **${siteName}**${warningText} - ${siteAlerts.length} alert(s)`);
    });
  }

  lines.push('');

  // Alert Age Distribution
  lines.push('## ⏱️  Alert Age');
  lines.push('');

  const ageDistribution = analyzeAlertAge(alerts);
  lines.push(`- **<1 hour:** ${ageDistribution.recent} alert(s)`);
  lines.push(`- **1-24 hours:** ${ageDistribution.day} alert(s)`);
  lines.push(`- **>24 hours:** ${ageDistribution.stale} alert(s)`);

  if (ageDistribution.stale > 5) {
    lines.push('');
    lines.push(`⚠️  ${ageDistribution.stale} stale alerts need attention`);
  }
  lines.push('');

  // Recommendations
  lines.push('## 💡 Recommendations');
  lines.push('');

  const recommendations = generateSummaryRecommendations(alerts, group_by);
  recommendations.forEach((rec) => lines.push(`- ${rec}`));
  lines.push('');

  return lines.join('\n');
}

/**
 * Group alerts by type (extracted from diagnostics).
 */
function groupAlertsByType(alerts: T.Alert[]): Map<string, T.Alert[]> {
  const grouped = new Map<string, T.Alert[]>();

  for (const alert of alerts) {
    const diagnostics = alert.diagnostics ?? 'Unknown';
    
    // Extract category (text before colon or first few words)
    const match = diagnostics.match(/^([^:-]+)/);
    const category = match ? match[1]!.trim() : diagnostics.substring(0, 30);

    const existing = grouped.get(category) ?? [];
    existing.push(alert);
    grouped.set(category, existing);
  }

  return grouped;
}

/**
 * Group alerts by device.
 */
function groupAlertsByDevice(alerts: T.Alert[]): Map<string, T.Alert[]> {
  const grouped = new Map<string, T.Alert[]>();

  for (const alert of alerts) {
    const deviceName = alert.alertSourceInfo?.deviceName ?? 'Unknown Device';
    const existing = grouped.get(deviceName) ?? [];
    existing.push(alert);
    grouped.set(deviceName, existing);
  }

  return grouped;
}

/**
 * Group alerts by site.
 */
function groupAlertsBySite(alerts: T.Alert[]): Map<string, T.Alert[]> {
  const grouped = new Map<string, T.Alert[]>();

  for (const alert of alerts) {
    const siteName = alert.alertSourceInfo?.siteName ?? 'Unknown Site';
    const existing = grouped.get(siteName) ?? [];
    existing.push(alert);
    grouped.set(siteName, existing);
  }

  return grouped;
}

/**
 * Analyze alert age distribution.
 */
function analyzeAlertAge(alerts: T.Alert[]): { recent: number; day: number; stale: number } {
  const now = Date.now();
  const result = { recent: 0, day: 0, stale: 0 };

  for (const alert of alerts) {
    const alertTime = alert.timestamp
      ? typeof alert.timestamp === 'string'
        ? parseInt(alert.timestamp, 10)
        : alert.timestamp
      : 0;

    const age = now - alertTime;

    if (age < 3600000) {
      result.recent++;
    } else if (age < 86400000) {
      result.day++;
    } else {
      result.stale++;
    }
  }

  return result;
}

/**
 * Generate summary recommendations.
 */
function generateSummaryRecommendations(alerts: T.Alert[], group_by: string): string[] {
  const recommendations: string[] = [];

  if (alerts.length === 0) {
    return ['No alerts - System is healthy'];
  }

  const critical = alerts.filter((a) => a.priority === 'Critical');
  if (critical.length > 0) {
    recommendations.push(`**Priority:** Address ${critical.length} critical alert(s) first`);
  }

  // Check for common patterns
  const grouped = groupAlertsByType(alerts);
  const topType = Array.from(grouped.entries())
    .sort((a, b) => b[1].length - a[1].length)[0];

  if (topType && topType[1].length > 3) {
    recommendations.push(`**Pattern:** "${topType[0]}" affects ${topType[1].length} devices - Investigate common cause`);
  }

  // Device grouping advice
  if (group_by === 'device') {
    const deviceGroups = groupAlertsByDevice(alerts);
    const topDevice = Array.from(deviceGroups.entries())
      .sort((a, b) => b[1].length - a[1].length)[0];
    
    if (topDevice && topDevice[1].length > 3) {
      recommendations.push(`**Focus:** ${topDevice[0]} has ${topDevice[1].length} alerts - Use \`diagnose-device-issue\` to troubleshoot`);
    }
  }

  // Stale alert advice
  const staleCount = alerts.filter((a) => {
    const alertTime = a.timestamp
      ? typeof a.timestamp === 'string'
        ? parseInt(a.timestamp, 10)
        : a.timestamp
      : 0;
    return Date.now() - alertTime > 86400000;
  }).length;

  if (staleCount > 10) {
    recommendations.push(`**Cleanup:** ${staleCount} alerts are >24h old - Review and resolve or acknowledge`);
  }

  return recommendations;
}

/**
 * Format timestamp to human-readable string.
 */
function formatTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) return 'Unknown';
  
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  const date = new Date(ts);
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
