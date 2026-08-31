/**
 * Tier 1 Composite Tool: Get Device Health
 *
 * Complete device health snapshot with site context.
 * One-call device diagnostics for troubleshooting.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
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
 */
export async function getDeviceHealth(
  client: DattoClient,
  args: GetDeviceHealthArgs
): Promise<ToolResult> {
  const { device, site, include_history = true } = args;

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
      const searchParams: any = { max: 10 };
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
        detail: `Device not found: "${device}"${site ? ` at site "${site}"` : ''}. Try searching by exact hostname, UID, or MAC address.`,
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
      include_history
        ? (client.GET as any)('/v2/device/{deviceUid}/jobs', {
            params: { path: { deviceUid }, query: { max: 10 } },
          })
        : Promise.resolve({ data: null, error: null, response: new Response() }),
    ]);

    const alerts: T.Alert[] = (alertsRes.data as any)?.alerts ?? [];
    const audit: any = auditRes.data;
    const jobs: any[] = (jobsRes.data as any)?.jobs ?? [];

    // Build audit summary
    let auditSummary: Record<string, unknown> | undefined;
    if (audit) {
      auditSummary = {};
      if (audit.cpu) {
        auditSummary['cpu'] = { name: audit.cpu.name ?? null, cores: audit.cpu.cores ?? null };
      }
      if (audit.memory) {
        const totalGB = audit.memory.totalMemory
          ? (audit.memory.totalMemory / 1073741824).toFixed(1)
          : null;
        auditSummary['ram'] = { totalGb: totalGB };
      }
      if (audit.disks && audit.disks.length > 0) {
        auditSummary['disk'] = audit.disks.map((disk: any) => {
          const usedPercent =
            disk.capacity > 0
              ? (((disk.capacity - disk.freeSpace) / disk.capacity) * 100).toFixed(1)
              : '0';
          return {
            volume: disk.volume,
            capacityGb: (disk.capacity / 1073741824).toFixed(1),
            usedPercent: parseFloat(usedPercent),
          };
        });
      }
    }

    // Build recommendations
    const recommendations: string[] = generateDeviceRecommendations(resolvedDevice, alerts, audit);

    const result: Record<string, unknown> = {
      device: {
        hostname: resolvedDevice.hostname ?? null,
        uid: deviceUid,
        online: resolvedDevice.online ?? false,
        siteUid: resolvedDevice.siteUid ?? null,
        siteName: resolvedDevice.siteName ?? null,
        deviceType: resolvedDevice.deviceType?.type ?? null,
        os: resolvedDevice.operatingSystem ?? null,
        lastSeen: resolvedDevice.lastSeen ?? null,
      },
      alerts,
      recommendations,
    };

    if (auditSummary) {
      result['auditSummary'] = auditSummary;
    }

    if (include_history && jobs.length > 0) {
      result['recentJobs'] = jobs.slice(0, 10).map((job: any) => ({
        jobUid: job.jobUid ?? null,
        jobType: job.jobType ?? null,
        status: job.status ?? null,
        startTime: job.startTime ?? null,
      }));
    }

    return successResponse({ data: result });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
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

  if (!device.online) {
    recommendations.push('Device is offline - Check network connectivity and agent status');
    recommendations.push('Use rmm_diagnose_device_issue for detailed troubleshooting');
    return recommendations;
  }

  const critical = alerts.filter((a) => a.priority === 'Critical');
  if (critical.length > 0) {
    recommendations.push(`${critical.length} critical alert(s) require immediate attention`);
    const diskAlerts = critical.filter((a) => a.diagnostics?.toLowerCase().includes('disk'));
    const serviceAlerts = critical.filter((a) => a.diagnostics?.toLowerCase().includes('service'));
    if (diskAlerts.length > 0) {
      recommendations.push('Run disk cleanup component to free space');
    }
    if (serviceAlerts.length > 0) {
      recommendations.push('Check and restart critical services');
    }
  }

  if (audit?.disks) {
    for (const disk of audit.disks) {
      const usedPercent = ((disk.capacity - disk.freeSpace) / disk.capacity) * 100;
      if (usedPercent > 90) {
        recommendations.push(`${disk.volume} drive critical (${usedPercent.toFixed(0)}% full) - Free space immediately`);
      } else if (usedPercent > 80) {
        recommendations.push(`${disk.volume} drive warning (${usedPercent.toFixed(0)}% full) - Monitor disk usage`);
      }
    }
  }

  if (alerts.length > 5) {
    recommendations.push(`${alerts.length} total alerts - Use rmm_diagnose_device_issue to find root cause`);
  }

  if (alerts.length > 0 && recommendations.length === 0) {
    recommendations.push(`Investigate alert ${alerts[0]?.alertUid} with rmm_investigate_alert`);
  }

  return recommendations;
}
