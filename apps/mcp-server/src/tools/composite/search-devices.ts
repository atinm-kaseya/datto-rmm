/**
 * Tier 1 Composite Tool: Search Devices
 *
 * Intelligent device search across the account using natural language.
 * No need to know UIDs, filter IDs, or which site contains the device.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface SearchDevicesArgs {
  /** Search query - matches hostname, IP, site name, OS, or device type */
  query?: string;
  /** Filter by online status */
  status?: 'online' | 'offline' | 'all';
  /** Include only devices with open alerts */
  has_alerts?: boolean;
  /** Limit results */
  limit?: number;
}

interface DeviceWithAlerts extends T.Device {
  alertCount?: number;
}

/**
 * Search for devices across the account with intelligent filtering.
 */
export async function searchDevices(
  client: DattoClient,
  args: SearchDevicesArgs
): Promise<ToolResult> {
  const { query, status = 'all', has_alerts = false, limit = 20 } = args;

  try {
    const params: any = {
      max: Math.min(limit * 2, 250),
    };

    let allDevices: T.Device[] = [];

    if (query) {
      const searchStrategies = [
        { hostname: query },
        { siteName: query },
        { operatingSystem: query },
      ];

      const results = await Promise.all(
        searchStrategies.map(async (strategy) => {
          try {
            const response = await client.GET('/v2/account/devices', {
              params: { query: { ...params, ...strategy } },
            });
            return handleResponse<T.DevicesPage>(response);
          } catch {
            return { devices: [] };
          }
        })
      );

      const deviceMap = new Map<string, T.Device>();
      for (const result of results) {
        const devices = result.devices ?? [];
        for (const device of devices) {
          if (device.uid && !deviceMap.has(device.uid)) {
            deviceMap.set(device.uid, device);
          }
        }
      }

      allDevices = Array.from(deviceMap.values());
    } else {
      const response = await client.GET('/v2/account/devices', {
        params: { query: params },
      });
      const devicesData = handleResponse<T.DevicesPage>(response);
      allDevices = devicesData.devices ?? [];
    }

    if (status !== 'all') {
      const isOnline = status === 'online';
      allDevices = allDevices.filter((d) => d.online === isOnline);
    }

    let devicesWithAlerts = allDevices;

    if (has_alerts) {
      devicesWithAlerts = await filterDevicesWithAlerts(client, allDevices);
    }

    if (query) {
      devicesWithAlerts = rankDevicesByRelevance(devicesWithAlerts, query);
    }

    const finalDevices = devicesWithAlerts.slice(0, limit);
    const enriched = await enrichWithAlertCounts(client, finalDevices);

    const data = enriched.map((device) => ({
      hostname: device.hostname ?? null,
      uid: device.uid ?? null,
      online: device.online ?? false,
      siteName: device.siteName ?? null,
      siteUid: device.siteUid ?? null,
      deviceType: device.deviceType?.type ?? null,
      operatingSystem: device.operatingSystem ?? null,
      internalIp: device.intIpAddress ?? null,
      alertCount: device.alertCount ?? 0,
    }));

    return successResponse({
      data,
      count: data.length,
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Filter devices to only those with open alerts.
 */
async function filterDevicesWithAlerts(
  client: DattoClient,
  devices: T.Device[]
): Promise<T.Device[]> {
  try {
    const response = await client.GET('/v2/account/alerts/open', {
      params: { query: { max: 250 } },
    });

    const alertsData = handleResponse<T.AlertsPage>(response);
    const alerts = alertsData.alerts ?? [];

    const alertedDeviceUids = new Set(
      alerts
        .map((alert) => alert.alertSourceInfo?.deviceUid)
        .filter((uid): uid is string => uid !== undefined && uid !== null)
    );

    return devices.filter((device) => device.uid && alertedDeviceUids.has(device.uid));
  } catch {
    return devices;
  }
}

/**
 * Add alert counts to devices for context.
 */
async function enrichWithAlertCounts(
  client: DattoClient,
  devices: T.Device[]
): Promise<DeviceWithAlerts[]> {
  const batchSize = 10;
  const enrichedDevices: DeviceWithAlerts[] = [];

  for (let i = 0; i < devices.length; i += batchSize) {
    const batch = devices.slice(i, i + batchSize);
    const alertPromises = batch.map(async (device) => {
      try {
        const response = await client.GET('/v2/device/{deviceUid}/alerts/open', {
          params: { path: { deviceUid: device.uid! }, query: { max: 1 } },
        });
        const alertsData = handleResponse<T.AlertsPage>(response);
        return {
          ...device,
          alertCount: alertsData.pageDetails?.totalCount ?? 0,
        };
      } catch {
        return { ...device, alertCount: 0 };
      }
    });

    const enrichedBatch = await Promise.all(alertPromises);
    enrichedDevices.push(...enrichedBatch);
  }

  return enrichedDevices;
}

/**
 * Rank devices by relevance to search query.
 */
function rankDevicesByRelevance(devices: T.Device[], query: string): T.Device[] {
  const lowerQuery = query.toLowerCase();

  const scored = devices.map((device) => {
    let score = 0;

    if (device.hostname?.toLowerCase() === lowerQuery) {
      score += 100;
    } else if (device.hostname?.toLowerCase().includes(lowerQuery)) {
      score += 50;
    }

    if (device.siteName?.toLowerCase().includes(lowerQuery)) {
      score += 30;
    }

    if (device.operatingSystem?.toLowerCase().includes(lowerQuery)) {
      score += 20;
    }

    if (device.intIpAddress?.includes(query) || device.extIpAddress?.includes(query)) {
      score += 40;
    }

    if (device.online) {
      score += 5;
    }

    return { device, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.device);
}
