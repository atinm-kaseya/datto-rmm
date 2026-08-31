/**
 * Composite tool: Get comprehensive device health information.
 * 
 * This demonstrates the task-oriented approach - one tool call gets all
 * relevant device information instead of requiring multiple API calls.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface DeviceHealthArgs {
  /** Device identifier: hostname, UID, or MAC address */
  device: string;
  /** Include historical data (recent jobs, resolved alerts) */
  include_history?: boolean;
}

/**
 * Get complete device health snapshot in one call.
 * 
 * Aggregates data from multiple API endpoints:
 * - Device details
 * - Open alerts
 * - Hardware audit
 * - Recent activity (if include_history=true)
 * - Installed software summary (critical apps only)
 */
export async function getDeviceHealth(
  client: DattoClient,
  args: DeviceHealthArgs
) {
  const { device, include_history = true } = args;

  try {
    // Step 1: Resolve device identifier to UID
    const deviceUid = await resolveDeviceIdentifier(client, device);
    if (!deviceUid) {
      return {
        content: [
          {
            type: 'text',
            text: `Device not found: "${device}". Try searching by exact hostname, UID, or MAC address.`,
          },
        ],
        isError: true,
      };
    }

    // Step 2: Fetch all device data in parallel
    const [deviceInfo, openAlerts, auditData, recentActivity] = await Promise.allSettled([
      // Core device information
      client.GET('/v2/device/{deviceUid}', {
        params: { path: { deviceUid } },
      }),

      // Open alerts
      client.GET('/v2/device/{deviceUid}/alerts/open', {
        params: { path: { deviceUid } },
      }),

      // Hardware audit
      client.GET('/v2/audit/device/{deviceUid}', {
        params: { path: { deviceUid } },
      }),

      // Recent activity (if requested)
      include_history
        ? client.GET('/v2/activity-logs', {
            params: {
              query: {
                size: 20,
                order: 'desc',
              },
            },
          })
        : Promise.resolve({ data: null }),
    ]);

    // Step 3: Build comprehensive health report
    const report = buildHealthReport({
      deviceInfo: deviceInfo.status === 'fulfilled' ? deviceInfo.value.data : null,
      openAlerts: openAlerts.status === 'fulfilled' ? openAlerts.value.data : null,
      auditData: auditData.status === 'fulfilled' ? auditData.value.data : null,
      recentActivity: recentActivity.status === 'fulfilled' ? recentActivity.value.data : null,
      include_history,
    });

    return {
      content: [{ type: 'text', text: report }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Failed to get device health: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Resolve various device identifiers to UID.
 * Supports: hostname, UID (passthrough), MAC address
 */
async function resolveDeviceIdentifier(
  client: DattoClient,
  identifier: string
): Promise<string | null> {
  // If it looks like a UID, use it directly
  if (identifier.match(/^[a-f0-9-]{36}$/i)) {
    return identifier;
  }

  // If it looks like a MAC address (12 hex chars, no separators)
  if (identifier.match(/^[a-f0-9]{12}$/i)) {
    const result = await client.GET('/v2/device/macAddress/{macAddress}', {
      params: { path: { macAddress: identifier } },
    });
    const devices = result.data ?? [];
    return devices.length > 0 ? devices[0]?.uid ?? null : null;
  }

  // Otherwise, search by hostname
  const response = await client.GET('/v2/account/devices', {
    params: {
      query: {
        hostname: identifier,
        max: 1,
      },
    },
  });

  try {
    const devicesData = handleResponse<T.DevicesPage>(response);
    const devices = devicesData.devices ?? [];
    return devices.length > 0 ? devices[0]?.uid ?? null : null;
  } catch {
    return null;
  }
}

/**
 * Build a human-readable health report from aggregated data.
 */
function buildHealthReport(data: {
  deviceInfo: any;
  openAlerts: any;
  auditData: any;
  recentActivity: any;
  include_history: boolean;
}): string {
  const { deviceInfo, openAlerts, auditData, include_history } = data;

  if (!deviceInfo) {
    return 'Unable to retrieve device information.';
  }

  const device = deviceInfo;
  const alerts = openAlerts?.alerts ?? [];
  const audit = auditData;

  // Build report sections
  const sections: string[] = [];

  // === Device Overview ===
  sections.push('# Device Health Report\n');
  sections.push(`## ${device.hostname}\n`);
  sections.push('### Status');
  sections.push(`- **Online**: ${device.online ? '✓ Yes' : '✗ No'}`);
  sections.push(`- **Last Seen**: ${formatTimestamp(device.lastSeen)}`);
  sections.push(`- **Site**: ${device.siteName}`);
  sections.push(`- **Type**: ${device.deviceType?.type ?? 'Unknown'}`);
  sections.push('');

  // === System Information ===
  sections.push('### System Information');
  sections.push(`- **OS**: ${device.operatingSystem ?? 'Unknown'}`);
  sections.push(`- **Internal IP**: ${device.intIpAddress ?? 'N/A'}`);
  sections.push(`- **External IP**: ${device.extIpAddress ?? 'N/A'}`);
  sections.push(`- **Domain**: ${device.domain ?? 'N/A'}`);
  sections.push(`- **Last User**: ${device.lastLoggedInUser ?? 'N/A'}`);
  sections.push('');

  // === Hardware ===
  if (audit) {
    sections.push('### Hardware');
    sections.push(`- **CPU**: ${audit.cpu?.name ?? 'Unknown'} (${audit.cpu?.cores ?? '?'} cores)`);
    sections.push(`- **RAM**: ${formatBytes(audit.memory?.totalMemory)}`);
    sections.push(`- **Disk**: ${formatBytes(audit.disk?.totalStorage)}`);
    if (audit.disk?.freeStorage) {
      const freePercent = ((audit.disk.freeStorage / audit.disk.totalStorage) * 100).toFixed(1);
      sections.push(`- **Free Space**: ${formatBytes(audit.disk.freeStorage)} (${freePercent}%)`);
    }
    sections.push('');
  }

  // === Alerts ===
  sections.push(`### Open Alerts (${alerts.length})`);
  if (alerts.length === 0) {
    sections.push('✓ No open alerts\n');
  } else {
    const critical = alerts.filter((a: any) => a.priority === 'critical');
    const warnings = alerts.filter((a: any) => a.priority !== 'critical');

    if (critical.length > 0) {
      sections.push(`\n**Critical (${critical.length}):**`);
      critical.slice(0, 5).forEach((alert: any) => {
        sections.push(`- ⚠️  ${alert.alertMessage} (${formatTimestamp(alert.timestamp)})`);
      });
    }

    if (warnings.length > 0) {
      sections.push(`\n**Warnings (${warnings.length}):**`);
      warnings.slice(0, 5).forEach((alert: any) => {
        sections.push(`- ⚡ ${alert.alertMessage} (${formatTimestamp(alert.timestamp)})`);
      });
    }

    if (alerts.length > 10) {
      sections.push(`\n_... and ${alerts.length - 10} more alerts_`);
    }
    sections.push('');
  }

  // === Recommendations ===
  sections.push('### Recommendations');
  const recommendations = generateRecommendations(device, alerts, audit);
  if (recommendations.length === 0) {
    sections.push('✓ System appears healthy\n');
  } else {
    recommendations.forEach((rec) => sections.push(`- ${rec}`));
    sections.push('');
  }

  // === Additional Info ===
  if (include_history) {
    sections.push('---');
    sections.push('_Use investigate-alert or run-component for detailed troubleshooting_');
  }

  return sections.join('\n');
}

/**
 * Generate actionable recommendations based on device state.
 */
function generateRecommendations(device: any, alerts: any[], audit: any): string[] {
  const recommendations: string[] = [];

  // Offline device
  if (!device.online) {
    recommendations.push('🔴 Device is offline - check network connectivity and agent status');
  }

  // Critical alerts
  const critical = alerts.filter((a) => a.priority === 'critical');
  if (critical.length > 0) {
    recommendations.push(`⚠️  ${critical.length} critical alert(s) require immediate attention`);
  }

  // Low disk space
  if (audit?.disk?.freeStorage && audit?.disk?.totalStorage) {
    const freePercent = (audit.disk.freeStorage / audit.disk.totalStorage) * 100;
    if (freePercent < 10) {
      recommendations.push('💾 Low disk space (<10%) - consider cleanup or expansion');
    }
  }

  // Many alerts
  if (alerts.length > 5) {
    recommendations.push(`📊 Device has ${alerts.length} open alerts - investigate common causes`);
  }

  // Old last seen (>7 days)
  if (device.lastSeen) {
    const daysSinceLastSeen = (Date.now() - device.lastSeen) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSeen > 7) {
      recommendations.push('⏰ Device hasn\'t checked in for over 7 days - verify agent status');
    }
  }

  return recommendations;
}

/**
 * Format timestamp to human-readable string.
 */
function formatTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) return 'Unknown';
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format bytes to human-readable size.
 */
function formatBytes(bytes: number | undefined): string {
  if (!bytes) return 'Unknown';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
