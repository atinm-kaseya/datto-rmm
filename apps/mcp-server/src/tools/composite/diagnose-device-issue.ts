/**
 * Tier 1 Composite Tool: Diagnose Device Issue
 *
 * AI-assisted troubleshooting workflow with actionable recommendations.
 * Analyzes device state, recent changes, and provides prioritized action plan.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface DiagnoseDeviceIssueArgs {
  /** Device identifier: hostname, UID, or MAC address */
  device: string;
  /** Site name or UID (optional, helps resolve device) */
  site?: string;
  /** Brief description of the problem (e.g., "slow performance", "backup failing") */
  issue: string;
}

/**
 * Diagnose device issue with AI-friendly recommendations.
 */
export async function diagnoseDeviceIssue(
  client: DattoClient,
  args: DiagnoseDeviceIssueArgs
): Promise<ToolResult> {
  const { device, site, issue } = args;

  try {
    let deviceUid: string | null = null;
    let resolvedDevice: T.Device | null = null;

    if (device.match(/^[a-zA-Z0-9-]{20,}$/)) {
      const deviceRes = await client.GET('/v2/device/{deviceUid}', {
        params: { path: { deviceUid: device } },
      });
      if (!deviceRes.error) {
        resolvedDevice = deviceRes.data ?? null;
        deviceUid = device;
      }
    }

    if (!deviceUid) {
      const searchParams: any = { max: 10, hostname: device };
      const devicesRes = await client.GET('/v2/account/devices', {
        params: { query: searchParams },
      });

      const devicesData = handleResponse<T.DevicesPage>(devicesRes);
      const devices = devicesData.devices ?? [];

      if (site && devices.length > 1) {
        const filtered = devices.filter(
          (d) =>
            d.siteName?.toLowerCase().includes(site.toLowerCase()) ||
            d.siteUid === site
        );
        if (filtered.length > 0) {
          resolvedDevice = filtered[0] ?? null;
          deviceUid = filtered[0]?.uid ?? null;
        }
      } else if (devices.length > 0) {
        resolvedDevice = devices[0] ?? null;
        deviceUid = devices[0]?.uid ?? null;
      }
    }

    if (!deviceUid || !resolvedDevice) {
      return errorResponse({
        error: 'entity_not_found',
        detail: `Device not found: "${device}"${site ? ` at site "${site}"` : ''}. Try using rmm_search_devices first.`,
        code: 404,
      });
    }

    const [alertsRes, auditRes, jobsRes] = await Promise.all([
      client.GET('/v2/device/{deviceUid}/alerts/open', {
        params: { path: { deviceUid } },
      }),
      client.GET('/v2/audit/device/{deviceUid}', {
        params: { path: { deviceUid } },
      }),
      (client.GET as any)('/v2/device/{deviceUid}/jobs', {
        params: { path: { deviceUid }, query: { max: 10 } },
      }),
    ]);

    const alerts: T.Alert[] = (alertsRes.data as any)?.alerts ?? [];
    const audit: any = auditRes.data;
    const jobs: any[] = (jobsRes.data as any)?.jobs ?? [];

    const findings = buildFindings(resolvedDevice, issue, alerts, audit, jobs);
    const recommendations = buildRecommendations(resolvedDevice, issue, alerts, audit, jobs);

    return successResponse({
      data: {
        device: {
          hostname: resolvedDevice.hostname ?? null,
          uid: deviceUid,
          siteName: resolvedDevice.siteName ?? null,
          online: resolvedDevice.online ?? false,
          os: resolvedDevice.operatingSystem ?? null,
          lastSeen: resolvedDevice.lastSeen ?? null,
        },
        issue,
        findings,
        recommendations,
      },
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Build list of findings from diagnostics data.
 */
function buildFindings(
  device: T.Device,
  issue: string,
  alerts: T.Alert[],
  audit: any,
  jobs: any[]
): string[] {
  const findings: string[] = [];

  if (!device.online) {
    findings.push('Device is offline');
    return findings;
  }

  const relatedKeywords = extractKeywords(issue);
  const relatedAlerts = alerts.filter((a) => {
    const alertText = (a.diagnostics ?? '').toLowerCase();
    return relatedKeywords.some((kw) => alertText.includes(kw));
  });

  if (relatedAlerts.length > 0) {
    relatedAlerts.slice(0, 5).forEach((alert) => {
      findings.push(`${alert.priority ?? 'Unknown'} alert: ${alert.diagnostics}`);
    });
  } else if (alerts.length > 0) {
    findings.push(`No alerts directly match "${issue}", but device has ${alerts.length} other alert(s)`);
  } else {
    findings.push('No open alerts found');
  }

  if (audit?.disks) {
    const lowDiskDrives = audit.disks.filter((d: any) => {
      const usedPercent = ((d.capacity - d.freeSpace) / d.capacity) * 100;
      return usedPercent > 80;
    });
    for (const disk of lowDiskDrives) {
      const usedPercent = ((disk.capacity - disk.freeSpace) / disk.capacity) * 100;
      findings.push(`${disk.volume} drive at ${usedPercent.toFixed(0)}% capacity`);
    }
  }

  const failedJobs = jobs.filter((j: any) => j.status === 'failed');
  if (failedJobs.length > 0) {
    findings.push(`${failedJobs.length} recent job failure(s)`);
  }

  return findings;
}

/**
 * Build prioritized recommendations.
 */
function buildRecommendations(
  device: T.Device,
  issue: string,
  alerts: T.Alert[],
  audit: any,
  jobs: any[]
): Array<{ priority: 'high' | 'medium' | 'low'; action: string }> {
  const recs: Array<{ priority: 'high' | 'medium' | 'low'; action: string }> = [];

  if (!device.online) {
    recs.push({ priority: 'high', action: 'Check network connectivity and verify device is powered on' });
    recs.push({ priority: 'high', action: 'Use rmm_get_site_health to see if other devices at the site are affected' });
    recs.push({ priority: 'medium', action: 'Restart Datto RMM agent if device is accessible via other means' });
    return recs;
  }

  const diskAlerts = alerts.filter((a) => a.diagnostics?.toLowerCase().includes('disk'));
  if (diskAlerts.length > 0) {
    recs.push({ priority: 'high', action: 'Free disk space - Run "Disk Cleanup" component' });
    recs.push({ priority: 'medium', action: 'Clear temporary files and old logs' });
  }

  const serviceAlerts = alerts.filter((a) => a.diagnostics?.toLowerCase().includes('service'));
  if (serviceAlerts.length > 0) {
    recs.push({ priority: 'high', action: 'Restart critical services - Check Windows services or specific application services' });
  }

  const failedJobs = jobs.filter((j: any) => j.status === 'failed');
  if (failedJobs.length > 0) {
    recs.push({ priority: 'medium', action: `Review ${failedJobs.length} failed job(s) - Check job logs for error details` });
  }

  const lower = issue.toLowerCase();
  if (lower.includes('slow') || lower.includes('performance')) {
    recs.push({ priority: 'medium', action: 'Check resource usage - CPU, memory, and disk I/O' });
    recs.push({ priority: 'medium', action: 'Review running processes for abnormal activity' });
  }

  if (lower.includes('backup')) {
    recs.push({ priority: 'high', action: 'Verify backup service is running' });
    recs.push({ priority: 'medium', action: 'Check available disk space for backup destination' });
    recs.push({ priority: 'medium', action: 'Review backup job logs for specific errors' });
  }

  if (recs.length === 0) {
    recs.push({ priority: 'medium', action: 'Review all open alerts for clues' });
    recs.push({ priority: 'low', action: 'Check recent job history for failures' });
    recs.push({ priority: 'low', action: 'Use rmm_investigate_alert on any critical alerts' });
  }

  recs.push({ priority: 'low', action: 'Use rmm_get_device_health to track progress after taking actions' });

  return recs;
}

/**
 * Extract keywords from issue description.
 */
function extractKeywords(issue: string): string[] {
  const lower = issue.toLowerCase();
  const keywords: string[] = [];

  if (lower.includes('slow') || lower.includes('performance')) {
    keywords.push('cpu', 'memory', 'disk', 'performance');
  }
  if (lower.includes('disk') || lower.includes('space')) {
    keywords.push('disk', 'storage', 'space');
  }
  if (lower.includes('backup')) {
    keywords.push('backup', 'veeam', 'shadow copy');
  }
  if (lower.includes('network') || lower.includes('connectivity')) {
    keywords.push('network', 'connection', 'ping', 'dns');
  }
  if (lower.includes('service')) {
    keywords.push('service', 'stopped', 'failed');
  }

  return keywords;
}
