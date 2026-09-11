/**
 * Tier 1 Composite Tool: Investigate Alert
 *
 * Deep alert analysis with pattern detection and recommendations.
 * Finds similar alerts across devices to identify systemic issues.
 */

import type { DattoClient } from 'datto-rmm-api';
import { successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface InvestigateAlertArgs {
  /** Alert UID to investigate */
  alert_uid: string;
  /** Find similar alerts on other devices (default: true) */
  include_similar?: boolean;
}

/**
 * Deep analysis of a specific alert with context and recommendations.
 */
export async function investigateAlert(
  client: DattoClient,
  args: InvestigateAlertArgs
): Promise<ToolResult> {
  const { alert_uid, include_similar = true } = args;

  try {
    const alertRes = (await client.GET('/v2/alert/{alertUid}', {
      params: { path: { alertUid: alert_uid } },
    })) as any;

    if (alertRes.error || !alertRes.data) {
      return errorResponse({
        error: 'entity_not_found',
        detail: `Alert not found: ${alert_uid}`,
        code: 404,
      });
    }

    const alert = alertRes.data as T.Alert;
    const deviceUid = alert.alertSourceInfo?.deviceUid;
    const siteUid = alert.alertSourceInfo?.siteUid;

    if (!deviceUid) {
      return errorResponse({
        error: 'entity_not_found',
        detail: 'Alert has no associated device information',
        code: 404,
      });
    }

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
    const allAlerts: T.Alert[] = allAlertsRes?.data?.alerts ?? [];

    const similarAlerts = include_similar ? findSimilarAlerts(alert, allAlerts) : [];

    // Build impact string
    const impact = buildImpact(alert, device, similarAlerts);
    const resolutionSuggestions = generateAlertResolutions(alert, device, similarAlerts);

    return successResponse({
      data: {
        alert: {
          uid: alert.alertUid ?? alert_uid,
          priority: alert.priority ?? null,
          diagnostics: alert.diagnostics ?? null,
          timestamp: alert.timestamp ?? null,
          deviceName: device?.hostname ?? alert.alertSourceInfo?.deviceName ?? null,
          siteName: site?.name ?? alert.alertSourceInfo?.siteName ?? null,
        },
        device: device
          ? {
              hostname: device.hostname ?? null,
              uid: device.uid ?? null,
              online: device.online ?? false,
              siteName: device.siteName ?? null,
              os: device.operatingSystem ?? null,
              lastSeen: device.lastSeen ?? null,
            }
          : null,
        similarAlerts: similarAlerts.slice(0, 10).map((a) => ({
          uid: a.alertUid ?? null,
          priority: a.priority ?? null,
          diagnostics: a.diagnostics ?? null,
          deviceName: a.alertSourceInfo?.deviceName ?? null,
          siteName: a.alertSourceInfo?.siteName ?? null,
          timestamp: a.timestamp ?? null,
        })),
        impact,
        resolutionSuggestions,
      },
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Find similar alerts (same type/category on different devices).
 */
function findSimilarAlerts(sourceAlert: T.Alert, allAlerts: T.Alert[]): T.Alert[] {
  const sourceText = (sourceAlert.diagnostics ?? '').toLowerCase();
  const sourceDevice = sourceAlert.alertSourceInfo?.deviceUid;

  const categoryMatch = sourceText.match(/^([^:-]+)/);
  const category = categoryMatch ? categoryMatch[1]!.trim() : '';

  if (!category) return [];

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
 * Build impact description string.
 */
function buildImpact(alert: T.Alert, device: any, similarAlerts: T.Alert[]): string {
  const parts: string[] = [];

  if (alert.priority === 'Critical') {
    parts.push('Critical severity - Requires immediate attention');
  } else if (alert.priority === 'High') {
    parts.push('High severity - Should be addressed soon');
  } else {
    parts.push('Informational severity');
  }

  if (!device?.online) {
    parts.push('Device is currently offline - Alert may be stale');
  }

  if (similarAlerts.length > 5) {
    parts.push(`Affects ${similarAlerts.length + 1} devices - Likely a systemic issue`);
  } else if (similarAlerts.length > 0) {
    parts.push(`Affects ${similarAlerts.length + 1} devices total`);
  } else {
    parts.push('Isolated to this device only');
  }

  return parts.join('. ');
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

  if (alertText.includes('disk') || alertText.includes('space')) {
    suggestions.push('Run disk cleanup component to free space');
    suggestions.push('Clear Windows Update cache and temporary files');
    suggestions.push('Check for large log files or old backups');
    if (similarAlerts.length > 3) {
      suggestions.push('Multiple devices low on space - Review backup retention policy account-wide');
    }
  } else if (alertText.includes('service')) {
    suggestions.push('Check and restart the affected service');
    suggestions.push('Review Windows Event Logs for service crash details');
    suggestions.push('Verify service dependencies are running');
  } else if (alertText.includes('cpu') || alertText.includes('performance')) {
    suggestions.push('Check Task Manager for processes with high CPU usage');
    suggestions.push('Look for runaway processes or malware');
    suggestions.push('Consider rebooting if issue persists');
  } else if (alertText.includes('offline') || !device?.online) {
    suggestions.push('Verify network connectivity');
    suggestions.push('Check if Datto RMM agent service is running');
    suggestions.push('Review firewall rules for agent communication');
  } else {
    suggestions.push('Use rmm_get_device_health for comprehensive device snapshot');
    suggestions.push('Review recent job history for related failures');
    suggestions.push('Check device audit logs for recent changes');
  }

  if (similarAlerts.length > 3) {
    suggestions.push('Multi-device pattern detected: use rmm_get_alert_summary to analyze account-wide');
    suggestions.push('Consider bulk remediation at site level if all at same site');
  }

  return suggestions;
}
