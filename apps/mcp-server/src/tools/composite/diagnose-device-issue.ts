/**
 * Tier 1 Composite Tool: Diagnose Device Issue
 * 
 * AI-assisted troubleshooting workflow with actionable recommendations.
 * Analyzes device state, recent changes, and provides prioritized action plan.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
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
 * 
 * Aggregates data from multiple endpoints:
 * - Device details and current state
 * - Open alerts (filtered by relevance to issue)
 * - Hardware audit
 * - Recent job history (successes/failures)
 * - Activity logs (recent changes)
 * 
 * Returns diagnosis with likely causes and action plan.
 */
export async function diagnoseDeviceIssue(
  client: DattoClient,
  args: DiagnoseDeviceIssueArgs
): Promise<ToolResult> {
  const { device, site, issue } = args;

  try {
    // Step 1: Resolve device
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
      return errorResult(
        `Device not found: "${device}"${site ? ` at site "${site}"` : ''}. Try using rmm_search_devices first.`
      );
    }

    // Step 2: Gather diagnostic data in parallel
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

    const alerts = (alertsRes.data as any)?.alerts ?? [];
    const audit = auditRes.data;
    const jobs = (jobsRes.data as any)?.jobs ?? [];

    // Step 3: Build diagnostic report
    const report = buildDiagnosticReport({
      device: resolvedDevice,
      issue,
      alerts,
      audit,
      jobs,
    });

    return {
      content: [{ type: 'text', text: report }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Diagnosis failed: ${message}`);
  }
}

/**
 * Build diagnostic report with issue analysis and action plan.
 */
function buildDiagnosticReport(data: {
  device: T.Device;
  issue: string;
  alerts: T.Alert[];
  audit: any;
  jobs: any[];
}): string {
  const { device, issue, alerts, audit, jobs } = data;

  const lines: string[] = [];

  // Header
  lines.push(`# Diagnostic Report: ${device.hostname ?? 'Unknown'}`);
  lines.push('');
  lines.push(`**Site:** ${device.siteName ?? 'Unknown'}`);
  lines.push(`**Issue:** "${issue}"`);
  lines.push('');

  // Device Status Snapshot
  const statusIcon = device.online ? '🟢' : '🔴';
  lines.push(`## ${statusIcon} Current Status`);
  lines.push('');
  lines.push(`**Online:** ${device.online ? 'Yes' : 'No'}`);
  lines.push(`**Last Seen:** ${formatTimestamp(device.lastSeen)}`);
  lines.push(`**OS:** ${device.operatingSystem ?? 'Unknown'}`);
  lines.push('');

  // Related Findings
  lines.push('## 🔍 Related Findings');
  lines.push('');

  // Filter alerts by relevance to issue
  const relatedKeywords = extractKeywords(issue);
  const relatedAlerts = alerts.filter((a) => {
    const alertText = (a.diagnostics ?? '').toLowerCase();
    return relatedKeywords.some((kw) => alertText.includes(kw));
  });

  if (relatedAlerts.length > 0) {
    relatedAlerts.slice(0, 5).forEach((alert) => {
      const icon = alert.priority === 'Critical' ? '🔴' : '⚠️ ';
      lines.push(`- ${icon} ${alert.diagnostics} _(${formatTimestamp(alert.timestamp)})_`);
    });
  } else if (alerts.length > 0) {
    lines.push(`_No alerts directly match "${issue}", but device has ${alerts.length} other alert(s)_`);
  } else {
    lines.push('✅ No open alerts found');
  }
  lines.push('');

  // Hardware insights
  if (audit?.disks) {
    const lowDiskDrives = audit.disks.filter((d: any) => {
      const usedPercent = ((d.capacity - d.freeSpace) / d.capacity) * 100;
      return usedPercent > 80;
    });
    
    if (lowDiskDrives.length > 0) {
      lines.push('**Hardware Concerns:**');
      lowDiskDrives.forEach((disk: any) => {
        const usedPercent = ((disk.capacity - disk.freeSpace) / disk.capacity) * 100;
        lines.push(`- ${disk.volume} drive at ${usedPercent.toFixed(0)}% capacity`);
      });
      lines.push('');
    }
  }

  // Recent Job History
  if (jobs.length > 0) {
    lines.push('## 📋 Recent Job History');
    lines.push('');

    const failed = jobs.filter((j: any) => j.status === 'failed');
    const succeeded = jobs.filter((j: any) => j.status === 'completed');

    jobs.slice(0, 5).forEach((job: any) => {
      const icon = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '⏳';
      lines.push(`- ${icon} ${job.jobType ?? 'Job'} _(${formatTimestamp(job.startTime)})_`);
    });

    if (failed.length > 0) {
      lines.push('');
      lines.push(`⚠️  ${failed.length} job(s) failed recently`);
    }
    lines.push('');
  }

  // Likely Causes
  lines.push('## 🎯 Likely Causes');
  lines.push('');

  const causes = identifyLikelyCauses(issue, device, alerts, audit, jobs);
  causes.forEach((cause, idx) => {
    lines.push(`${idx + 1}. ${cause}`);
  });
  lines.push('');

  // Action Plan
  lines.push('## 📋 Action Plan');
  lines.push('');

  const actions = generateActionPlan(issue, device, alerts, audit, jobs);
  actions.forEach((action, idx) => {
    lines.push(`**Step ${idx + 1}:** ${action}`);
    lines.push('');
  });

  // Next Steps
  lines.push('## 💡 Next Steps');
  lines.push('');
  lines.push(`- Use \`rmm_investigate_alert\` on critical alerts for deeper analysis`);
  lines.push(`- Use \`rmm_get_site_health\` to check if issue affects other devices`);
  lines.push(`- Consider running relevant components from recommendations above`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Extract keywords from issue description.
 */
function extractKeywords(issue: string): string[] {
  const lower = issue.toLowerCase();
  const keywords: string[] = [];

  // Common issue keywords
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

/**
 * Identify likely causes based on symptoms.
 */
function identifyLikelyCauses(
  issue: string,
  device: T.Device,
  alerts: T.Alert[],
  audit: any,
  jobs: any[]
): string[] {
  const causes: string[] = [];

  if (!device.online) {
    causes.push('Device is offline - Network issue, power loss, or agent stopped');
    return causes;
  }

  // Disk space issues
  const diskAlerts = alerts.filter((a) => a.diagnostics?.toLowerCase().includes('disk'));
  if (diskAlerts.length > 0 || issue.toLowerCase().includes('disk')) {
    causes.push('Disk space exhaustion - May cause performance degradation or service failures');
  }

  // Service failures
  const serviceAlerts = alerts.filter((a) => a.diagnostics?.toLowerCase().includes('service'));
  if (serviceAlerts.length > 0 || issue.toLowerCase().includes('service')) {
    causes.push('Critical services stopped - Application unavailability or crashes');
  }

  // Failed jobs
  const failedJobs = jobs.filter((j: any) => j.status === 'failed');
  if (failedJobs.length > 2) {
    causes.push(`Multiple job failures (${failedJobs.length} recent) - Agent communication or permissions issue`);
  }

  // Performance issues
  if (issue.toLowerCase().includes('slow') || issue.toLowerCase().includes('performance')) {
    if (audit?.disks) {
      const highDisk = audit.disks.some((d: any) => ((d.capacity - d.freeSpace) / d.capacity) > 0.9);
      if (highDisk) {
        causes.push('High disk usage (>90%) - Can significantly impact system performance');
      }
    }
    if (alerts.some((a) => a.diagnostics?.toLowerCase().includes('cpu'))) {
      causes.push('High CPU usage detected - Check for runaway processes or malware');
    }
  }

  if (causes.length === 0) {
    causes.push('No obvious issues detected from current state - May require deeper investigation');
  }

  return causes;
}

/**
 * Generate prioritized action plan.
 */
function generateActionPlan(
  issue: string,
  device: T.Device,
  alerts: T.Alert[],
  audit: any,
  jobs: any[]
): string[] {
  const actions: string[] = [];

  if (!device.online) {
    actions.push('Check network connectivity and verify device is powered on');
    actions.push('Use `rmm_get_site_health` to see if other devices at the site are affected');
    actions.push('Restart Datto RMM agent if device is accessible via other means');
    return actions;
  }

  // Handle disk space issues
  const diskAlerts = alerts.filter((a) => a.diagnostics?.toLowerCase().includes('disk'));
  if (diskAlerts.length > 0) {
    actions.push('**Immediate:** Free disk space - Run "Disk Cleanup" component');
    actions.push('Clear temporary files and old logs');
  }

  // Handle service issues
  const serviceAlerts = alerts.filter((a) => a.diagnostics?.toLowerCase().includes('service'));
  if (serviceAlerts.length > 0) {
    actions.push('**Restart critical services** - Check Windows services or specific application services');
  }

  // Handle failed jobs
  const failedJobs = jobs.filter((j: any) => j.status === 'failed');
  if (failedJobs.length > 0) {
    actions.push(`Review ${failedJobs.length} failed job(s) - Check job logs for error details`);
  }

  // Performance issues
  if (issue.toLowerCase().includes('slow') || issue.toLowerCase().includes('performance')) {
    actions.push('Check resource usage - CPU, memory, and disk I/O');
    actions.push('Review running processes for abnormal activity');
    if (!actions.some((a) => a.includes('disk'))) {
      actions.push('Consider running disk cleanup if space is low');
    }
  }

  // Backup issues
  if (issue.toLowerCase().includes('backup')) {
    actions.push('Verify backup service is running');
    actions.push('Check available disk space for backup destination');
    actions.push('Review backup job logs for specific errors');
  }

  // Generic actions if nothing specific
  if (actions.length === 0) {
    actions.push('Review all open alerts for clues');
    actions.push('Check recent job history for failures');
    actions.push('Use `rmm_investigate_alert` on any critical alerts');
  }

  // Always suggest monitoring
  actions.push('**Monitor:** Use `rmm_get_device_health` to track progress after taking actions');

  return actions;
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
