/**
 * Tier 1 Composite Tool: Get Device Health
 * 
 * Complete device health snapshot with site context.
 * One-call device diagnostics for troubleshooting.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface GetDeviceHealthArgs {
  /** Device identifier: hostname, UID, or MAC address */
  device: string;
  /** Site name or UID (optional, helps resolve hostname faster) */
  site?: string;
  /** Include historical data (recent jobs, resolved alerts) */
  include_history?: boolean;
}

/**
 * Get complete device health snapshot.
 * 
 * Aggregates data from multiple endpoints:
 * - Device details (with site context)
 * - Open alerts
 * - Hardware audit
 * - Recent activity logs (if include_history=true)
 * - Job execution history
 */
export async function getDeviceHealth(
  client: DattoClient,
  args: GetDeviceHealthArgs
): Promise<ToolResult> {
  const { device, site, include_history = true } = args;

  try {
    // Step 1: Resolve device identifier to UID
    let deviceUid: string | null = null;
    let resolvedDevice: T.Device | null = null;

    // If it looks like a UID, use directly
    if (device.match(/^[a-zA-Z0-9-]{20,}$/)) {
      const deviceRes = await client.GET('/v2/device/{deviceUid}', {
        params: { path: { deviceUid: device } },
      });
      if (!deviceRes.error) {
        resolvedDevice = deviceRes.data ?? null;
        deviceUid = device;
      }
    }

    // If not found yet, search by hostname/MAC
    if (!deviceUid) {
      const searchParams: any = { max: 10 };
      
      // Check if MAC address (12 hex chars)
      if (device.match(/^[a-fA-F0-9]{12}$/)) {
        searchParams.macAddress = device;
      } else {
        searchParams.hostname = device;
      }

      const devicesRes = await client.GET('/v2/account/devices', {
        params: { query: searchParams },
      });

      const devicesData = handleResponse<T.DevicesPage>(devicesRes);
      const devices = devicesData.devices ?? [];

      // If site provided, filter to that site
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
        `Device not found: "${device}"${site ? ` at site "${site}"` : ''}. Try searching by exact hostname, UID, or MAC address.`
      );
    }

    // Step 2: Fetch all device data in parallel
    const [alertsRes, auditRes, jobsRes] = await Promise.all([
      client.GET('/v2/device/{deviceUid}/alerts/open', {
        params: { path: { deviceUid } },
      }),
      client.GET('/v2/audit/device/{deviceUid}', {
        params: { path: { deviceUid } },
      }),
      include_history
        ? (client.GET as any)('/v2/device/{deviceUid}/jobs', {
            params: {
              path: { deviceUid },
              query: { max: 10 },
            },
          })
        : Promise.resolve({ data: null, error: null, response: new Response() }),
    ]);

    const alertsData = alertsRes.data;
    const audit = auditRes.data;
    const jobsData = jobsRes.data as any;

    // Step 3: Build comprehensive health report
    const report = buildDeviceHealthReport({
      device: resolvedDevice,
      alerts: (alertsData as any)?.alerts ?? [],
      audit,
      jobs: jobsData?.jobs ?? [],
      include_history,
    });

    return {
      content: [{ type: 'text', text: report }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to get device health: ${message}`);
  }
}

/**
 * Build comprehensive device health report.
 */
function buildDeviceHealthReport(data: {
  device: T.Device;
  alerts: T.Alert[];
  audit: any;
  jobs: any[];
  include_history: boolean;
}): string {
  const { device, alerts, audit, jobs, include_history } = data;

  const lines: string[] = [];

  // Header
  lines.push(`# Device Health: ${device.hostname ?? 'Unknown'}`);
  lines.push('');
  lines.push(`**Device UID:** \`${device.uid}\``);
  lines.push(`**Site:** ${device.siteName ?? 'Unknown'} (\`${device.siteUid}\`)`);
  lines.push('');

  // Status
  const statusIcon = device.online ? '🟢' : '🔴';
  const statusText = device.online ? 'Online' : 'Offline';
  lines.push(`## ${statusIcon} Status: ${statusText}`);
  lines.push('');
  lines.push(`**Last Seen:** ${formatTimestamp(device.lastSeen)}`);
  lines.push(`**Type:** ${device.deviceType?.type ?? 'Unknown'}`);
  lines.push(`**OS:** ${device.operatingSystem ?? 'Unknown'}`);
  lines.push('');

  // System Information
  lines.push('## 💻 System Information');
  lines.push('');
  lines.push(`**Internal IP:** ${device.intIpAddress ?? 'N/A'}`);
  lines.push(`**External IP:** ${device.extIpAddress ?? 'N/A'}`);
  lines.push(`**Domain:** ${device.domain ?? 'N/A'}`);
  lines.push(`**Last User:** ${device.lastLoggedInUser ?? 'N/A'}`);
  lines.push('');

  // Hardware (if audit data available)
  if (audit) {
    lines.push('## 🔧 Hardware');
    lines.push('');

    if (audit.cpu) {
      lines.push(`**CPU:** ${audit.cpu.name ?? 'Unknown'}`);
      lines.push(`- Cores: ${audit.cpu.cores ?? '?'}`);
    }

    if (audit.memory) {
      const totalGB = bytesToGB(audit.memory.totalMemory);
      lines.push(`**RAM:** ${totalGB.toFixed(1)} GB total`);
    }

    if (audit.disks && audit.disks.length > 0) {
      lines.push('**Disks:**');
      audit.disks.forEach((disk: any) => {
        const totalGB = bytesToGB(disk.capacity);
        const usedGB = bytesToGB(disk.capacity - disk.freeSpace);
        const usedPercent = ((disk.capacity - disk.freeSpace) / disk.capacity) * 100;
        const warningIcon = usedPercent > 90 ? '⚠️ ' : usedPercent > 80 ? '⚡' : '';
        lines.push(`- ${disk.volume}: ${usedGB.toFixed(1)} GB used / ${totalGB.toFixed(1)} GB (${usedPercent.toFixed(1)}% ${warningIcon})`);
      });
    }
    lines.push('');
  }

  // Open Alerts
  lines.push(`## ⚠️  Open Alerts (${alerts.length})`);
  lines.push('');

  if (alerts.length === 0) {
    lines.push('✅ No open alerts');
  } else {
    const critical = alerts.filter((a) => a.priority === 'Critical');
    const warnings = alerts.filter((a) => a.priority === 'High' || a.priority === 'Moderate');

    if (critical.length > 0) {
      lines.push(`**Critical (${critical.length}):**`);
      critical.slice(0, 5).forEach((alert) => {
        const time = formatTimestamp(alert.timestamp);
        lines.push(`- 🔴 ${alert.diagnostics ?? 'Alert'} _(${time})_`);
      });
      lines.push('');
    }

    if (warnings.length > 0) {
      lines.push(`**Warnings (${warnings.length}):**`);
      warnings.slice(0, 5).forEach((alert) => {
        const time = formatTimestamp(alert.timestamp);
        lines.push(`- ⚠️  ${alert.diagnostics ?? 'Alert'} _(${time})_`);
      });
      lines.push('');
    }

    if (alerts.length > 10) {
      lines.push(`_... and ${alerts.length - 10} more_`);
      lines.push('');
    }
  }

  // Recent Job History (if enabled)
  if (include_history && jobs.length > 0) {
    lines.push('## 📋 Recent Jobs');
    lines.push('');

    jobs.slice(0, 5).forEach((job: any) => {
      const status = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '⏳';
      const time = formatTimestamp(job.startTime);
      lines.push(`- ${status} ${job.jobType ?? 'Job'} _(${time})_`);
    });
    lines.push('');
  }

  // Recommendations
  lines.push('## 💡 Recommended Actions');
  lines.push('');

  const recommendations = generateDeviceRecommendations(device, alerts, audit);
  if (recommendations.length === 0) {
    lines.push('✅ Device appears healthy. No immediate actions needed.');
  } else {
    recommendations.forEach((rec, idx) => {
      lines.push(`${idx + 1}. ${rec}`);
    });
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate actionable recommendations based on device state.
 */
function generateDeviceRecommendations(
  device: T.Device,
  alerts: T.Alert[],
  audit: any
): string[] {
  const recommendations: string[] = [];

  // Offline device
  if (!device.online) {
    recommendations.push('🔴 **Device is offline** - Check network connectivity and agent status');
    recommendations.push('   Use `diagnose-device-issue` for detailed troubleshooting');
    return recommendations;
  }

  // Critical alerts
  const critical = alerts.filter((a) => a.priority === 'Critical');
  if (critical.length > 0) {
    recommendations.push(`⚠️  **${critical.length} critical alert(s)** require immediate attention`);
    
    // Check for specific alert types
    const diskAlerts = critical.filter((a) => a.diagnostics?.toLowerCase().includes('disk'));
    const serviceAlerts = critical.filter((a) => a.diagnostics?.toLowerCase().includes('service'));
    
    if (diskAlerts.length > 0) {
      recommendations.push('   Run disk cleanup component to free space');
    }
    if (serviceAlerts.length > 0) {
      recommendations.push('   Check and restart critical services');
    }
  }

  // Low disk space from audit
  if (audit?.disks) {
    for (const disk of audit.disks) {
      const usedPercent = ((disk.capacity - disk.freeSpace) / disk.capacity) * 100;
      if (usedPercent > 90) {
        recommendations.push(`💾 **${disk.volume} drive critical** (${usedPercent.toFixed(0)}% full) - Free space immediately`);
      } else if (usedPercent > 80) {
        recommendations.push(`⚡ **${disk.volume} drive warning** (${usedPercent.toFixed(0)}% full) - Monitor disk usage`);
      }
    }
  }

  // Many alerts overall
  if (alerts.length > 5) {
    recommendations.push(`📊 **${alerts.length} total alerts** - Use \`diagnose-device-issue\` to find root cause`);
  }

  // Suggest alert investigation
  if (alerts.length > 0 && recommendations.length === 0) {
    recommendations.push(`Use \`investigate-alert\` on alert UID: \`${alerts[0]?.alertUid}\` for deep analysis`);
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

  // Recent times
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  // Older times
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format bytes to GB.
 */
function bytesToGB(bytes: number | undefined): number {
  if (!bytes) return 0;
  return bytes / 1073741824;
}
