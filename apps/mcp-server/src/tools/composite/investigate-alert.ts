/**
 * Tier 1 Composite Tool: Investigate Alert
 * 
 * Deep alert analysis with pattern detection and recommendations.
 * Finds similar alerts across devices to identify systemic issues.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface InvestigateAlertArgs {
  /** Alert UID to investigate */
  alert_uid: string;
  /** Find similar alerts on other devices (default: true) */
  include_similar?: boolean;
}

/**
 * Deep analysis of a specific alert with context and recommendations.
 * 
 * Aggregates data from multiple endpoints:
 * - Alert details
 * - Device context
 * - Site context
 * - Similar alerts (if include_similar=true)
 * - Recent device activity
 */
export async function investigateAlert(
  client: DattoClient,
  args: InvestigateAlertArgs
): Promise<ToolResult> {
  const { alert_uid, include_similar = true } = args;

  try {
    // Step 1: Get alert details
    const alertRes = (await client.GET('/v2/alert/{alertUid}', {
      params: { path: { alertUid: alert_uid } },
    })) as any;

    if (alertRes.error || !alertRes.data) {
      return errorResult(`Alert not found: ${alert_uid}`);
    }

    const alert = alertRes.data as T.Alert;
    const deviceUid = alert.alertSourceInfo?.deviceUid;
    const siteUid = alert.alertSourceInfo?.siteUid;

    if (!deviceUid) {
      return errorResult('Alert has no associated device information');
    }

    // Step 2: Get context in parallel
    const contextCalls: Promise<any>[] = [
      client.GET('/v2/device/{deviceUid}', {
        params: { path: { deviceUid } },
      }),
    ];

    if (siteUid) {
      contextCalls.push(
        client.GET('/v2/site/{siteUid}', {
          params: { path: { siteUid } },
        })
      );
    }

    // Get similar alerts if requested
    if (include_similar) {
      contextCalls.push(
        client.GET('/v2/account/alerts/open', {
          params: { query: { max: 100 } },
        })
      );
    }

    const results = await Promise.all(contextCalls);
    
    const deviceRes = results[0];
    const siteRes = siteUid ? results[1] : null;
    const allAlertsRes = include_similar ? results[siteUid ? 2 : 1] : null;

    const device = deviceRes?.data;
    const site = siteRes?.data;
    const allAlerts = allAlertsRes?.data?.alerts ?? [];

    // Find similar alerts
    const similarAlerts = include_similar
      ? findSimilarAlerts(alert, allAlerts)
      : [];

    // Step 3: Build investigation report
    const report = buildInvestigationReport({
      alert,
      device,
      site,
      similarAlerts,
      include_similar,
    });

    return {
      content: [{ type: 'text', text: report }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Investigation failed: ${message}`);
  }
}

/**
 * Find similar alerts (same type/category on different devices).
 */
function findSimilarAlerts(sourceAlert: T.Alert, allAlerts: T.Alert[]): T.Alert[] {
  const sourceText = (sourceAlert.diagnostics ?? '').toLowerCase();
  const sourceDevice = sourceAlert.alertSourceInfo?.deviceUid;

  // Extract alert category (first few words before colon or dash)
  const categoryMatch = sourceText.match(/^([^:-]+)/);
  const category = categoryMatch ? categoryMatch[1]!.trim() : '';

  if (!category) return [];

  // Find alerts with similar category on different devices
  return allAlerts
    .filter((a) => {
      if (a.alertUid === sourceAlert.alertUid) return false;
      if (a.alertSourceInfo?.deviceUid === sourceDevice) return false;
      
      const alertText = (a.diagnostics ?? '').toLowerCase();
      return alertText.includes(category);
    })
    .slice(0, 10);
}

/**
 * Build investigation report.
 */
function buildInvestigationReport(data: {
  alert: T.Alert;
  device: any;
  site: any;
  similarAlerts: T.Alert[];
  include_similar: boolean;
}): string {
  const { alert, device, site, similarAlerts, include_similar } = data;

  const lines: string[] = [];

  // Header
  const priorityIcon = alert.priority === 'Critical' ? '🔴' : alert.priority === 'High' ? '⚠️ ' : 'ℹ️ ';
  lines.push(`# Alert Investigation: ${priorityIcon} ${alert.priority}`);
  lines.push('');
  lines.push(`**Alert UID:** \`${alert.alertUid}\``);
  lines.push(`**Message:** ${alert.diagnostics ?? 'No details'}`);
  lines.push(`**Opened:** ${formatTimestamp(alert.timestamp)}`);
  lines.push('');

  // Device Context
  if (device) {
    const statusIcon = device.online ? '🟢' : '🔴';
    lines.push('## 📱 Device Context');
    lines.push('');
    lines.push(`**Device:** ${device.hostname ?? 'Unknown'} ${statusIcon}`);
    lines.push(`**Device UID:** \`${device.uid}\``);
    lines.push(`**Site:** ${device.siteName ?? 'Unknown'}`);
    lines.push(`**OS:** ${device.operatingSystem ?? 'Unknown'}`);
    lines.push(`**Last Seen:** ${formatTimestamp(device.lastSeen)}`);
    lines.push('');
  }

  // Site Context
  if (site) {
    lines.push('## 🏢 Site Context');
    lines.push('');
    lines.push(`**Site:** ${site.name ?? 'Unknown'}`);
    lines.push(`**Site UID:** \`${site.uid}\``);
    if (site.devicesStatus) {
      lines.push(`**Devices:** ${site.devicesStatus.numberOfDevices} total (${site.devicesStatus.numberOfOnlineDevices} online, ${site.devicesStatus.numberOfOfflineDevices} offline)`);
    }
    lines.push('');
  }

  // Impact Assessment
  lines.push('## 📊 Impact Assessment');
  lines.push('');

  const impact = assessAlertImpact(alert, device, similarAlerts);
  impact.forEach((item) => lines.push(`- ${item}`));
  lines.push('');

  // Similar Alerts
  if (include_similar && similarAlerts.length > 0) {
    lines.push(`## 🔍 Similar Alerts (${similarAlerts.length})`);
    lines.push('');
    lines.push(`Found ${similarAlerts.length} similar alert(s) on other devices:`);
    lines.push('');

    similarAlerts.slice(0, 5).forEach((similar) => {
      const deviceName = similar.alertSourceInfo?.deviceName ?? 'Unknown device';
      const siteName = similar.alertSourceInfo?.siteName ?? 'Unknown site';
      const time = formatTimestamp(similar.timestamp);
      lines.push(`- **${deviceName}** (${siteName}) - ${time}`);
    });

    if (similarAlerts.length > 5) {
      lines.push(`- _... and ${similarAlerts.length - 5} more_`);
    }

    lines.push('');
    lines.push('⚠️  **Pattern detected:** This issue affects multiple devices');
    lines.push('');
  }

  // Resolution Suggestions
  lines.push('## 💡 Resolution Suggestions');
  lines.push('');

  const suggestions = generateAlertResolutions(alert, device, similarAlerts);
  suggestions.forEach((suggestion, idx) => {
    lines.push(`${idx + 1}. ${suggestion}`);
  });
  lines.push('');

  return lines.join('\n');
}

/**
 * Assess alert impact.
 */
function assessAlertImpact(alert: T.Alert, device: any, similarAlerts: T.Alert[]): string[] {
  const impact: string[] = [];

  if (alert.priority === 'Critical') {
    impact.push('🔴 **Severity:** Critical - Requires immediate attention');
  } else if (alert.priority === 'High') {
    impact.push('⚠️  **Severity:** High - Should be addressed soon');
  } else {
    impact.push('ℹ️  **Severity:** Informational');
  }

  if (!device?.online) {
    impact.push('Device is currently offline - Alert may be stale');
  }

  if (similarAlerts.length > 5) {
    impact.push(`**Scope:** Affects ${similarAlerts.length + 1} devices - Likely a systemic issue`);
  } else if (similarAlerts.length > 0) {
    impact.push(`**Scope:** Affects ${similarAlerts.length + 1} devices total`);
  } else {
    impact.push('**Scope:** Isolated to this device only');
  }

  return impact;
}

/**
 * Generate resolution suggestions.
 */
function generateAlertResolutions(
  alert: T.Alert,
  device: any,
  similarAlerts: T.Alert[]
): string[] {
  const suggestions: string[] = [];
  const alertText = (alert.diagnostics ?? '').toLowerCase();

  // Disk space alerts
  if (alertText.includes('disk') || alertText.includes('space')) {
    suggestions.push('**Immediate:** Run disk cleanup component to free space');
    suggestions.push('Clear Windows Update cache and temporary files');
    suggestions.push('Check for large log files or old backups');
    if (similarAlerts.length > 3) {
      suggestions.push('**Pattern:** Multiple devices low on space - Review backup retention policy account-wide');
    }
  }

  // Service alerts
  else if (alertText.includes('service')) {
    suggestions.push('**Immediate:** Check and restart the affected service');
    suggestions.push('Review Windows Event Logs for service crash details');
    suggestions.push('Verify service dependencies are running');
  }

  // CPU/Performance alerts
  else if (alertText.includes('cpu') || alertText.includes('performance')) {
    suggestions.push('Check Task Manager for processes with high CPU usage');
    suggestions.push('Look for runaway processes or malware');
    suggestions.push('Consider rebooting if issue persists');
  }

  // Offline alerts
  else if (alertText.includes('offline') || !device?.online) {
    suggestions.push('Verify network connectivity');
    suggestions.push('Check if Datto RMM agent service is running');
    suggestions.push('Review firewall rules for agent communication');
  }

  // Generic recommendations
  else {
    suggestions.push('Use `get-device-health` for comprehensive device snapshot');
    suggestions.push('Review recent job history for related failures');
    suggestions.push('Check device audit logs for recent changes');
  }

  // Add pattern detection advice if applicable
  if (similarAlerts.length > 3) {
    suggestions.push('');
    suggestions.push('**Multi-device pattern detected:**');
    suggestions.push(`Use \`get-alert-summary\` to analyze this alert type account-wide`);
    suggestions.push(`Consider bulk remediation at site level if all at same site`);
  }

  return suggestions;
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
