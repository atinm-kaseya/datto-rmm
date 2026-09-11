/**
 * Tier 1 Composite Tool: List Site Devices
 *
 * Browse and filter devices within a site.
 * Supports filtering by status, type, and alert presence.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface ListSiteDevicesArgs {
  /** Site identifier: name or UID */
  site: string;
  /** Filter by online status */
  status?: 'online' | 'offline' | 'all';
  /** Filter by device type (desktop, laptop, server, etc.) */
  type?: string;
  /** Only show devices with open alerts */
  has_alerts?: boolean;
  /** Sort order */
  sort_by?: 'name' | 'alerts' | 'last_seen';
}

/**
 * List and filter devices within a site.
 */
export async function listSiteDevices(
  client: DattoClient,
  args: ListSiteDevicesArgs
): Promise<ToolResult> {
  const {
    site,
    status = 'all',
    type,
    has_alerts = false,
    sort_by = 'name',
  } = args;

  try {
    // Resolve site
    let siteUid: string | null = null;

    if (site.match(/^[a-zA-Z0-9-]{20,}$/)) {
      siteUid = site;
    } else {
      const sitesRes = await client.GET('/v2/account/sites', {
        params: { query: { max: 50 } },
      });
      const sitesData = handleResponse<T.SitesPage>(sitesRes);
      const sites = sitesData.sites ?? [];
      const match = sites.find(
        (s) => s.name?.toLowerCase() === site.toLowerCase()
      );
      if (match) {
        siteUid = match.uid ?? null;
      }
    }

    if (!siteUid) {
      return errorResponse({
        error: 'entity_not_found',
        detail: `Site not found: "${site}". Try searching by exact name or UID.`,
        code: 404,
      });
    }

    // Fetch devices and optionally alerts
    const fetchPromises: Promise<any>[] = [
      client.GET('/v2/site/{siteUid}/devices', {
        params: { path: { siteUid }, query: { max: 100 } },
      }),
    ];

    if (has_alerts) {
      fetchPromises.push(
        client.GET('/v2/site/{siteUid}/alerts/open', {
          params: { path: { siteUid } },
        })
      );
    }

    const results = await Promise.all(fetchPromises);
    const devicesRes = results[0];
    const alertsRes = has_alerts ? results[1] : null;

    const devicesData = handleResponse<T.DevicesPage>(devicesRes);
    let devices = devicesData.devices ?? [];

    let alertCounts = new Map<string, number>();
    if (alertsRes) {
      const alertsData = handleResponse<T.AlertsPage>(alertsRes);
      const alerts = alertsData.alerts ?? [];
      for (const alert of alerts) {
        const deviceUid = alert.alertSourceInfo?.deviceUid;
        if (deviceUid) {
          alertCounts.set(deviceUid, (alertCounts.get(deviceUid) ?? 0) + 1);
        }
      }
    }

    // Apply filters
    if (status !== 'all') {
      const isOnline = status === 'online';
      devices = devices.filter((d) => d.online === isOnline);
    }

    if (type) {
      const typeFilter = type.toLowerCase();
      devices = devices.filter(
        (d) => d.deviceType?.type?.toLowerCase().includes(typeFilter)
      );
    }

    if (has_alerts) {
      devices = devices.filter((d) => (d.uid ? alertCounts.get(d.uid) : 0) ?? 0 > 0);
    }

    // Sort
    if (sort_by === 'alerts') {
      devices.sort((a, b) => {
        const aCount = (a.uid ? alertCounts.get(a.uid) : 0) ?? 0;
        const bCount = (b.uid ? alertCounts.get(b.uid) : 0) ?? 0;
        return bCount - aCount;
      });
    } else if (sort_by === 'last_seen') {
      devices.sort((a, b) => {
        const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return bTime - aTime;
      });
    } else {
      devices.sort((a, b) => {
        const aName = a.hostname ?? '';
        const bName = b.hostname ?? '';
        return aName.localeCompare(bName);
      });
    }

    const data = devices.map((device) => ({
      hostname: device.hostname ?? null,
      uid: device.uid ?? null,
      online: device.online ?? false,
      deviceType: device.deviceType?.type ?? null,
      alertCount: device.uid ? alertCounts.get(device.uid) ?? 0 : 0,
      internalIp: device.intIpAddress ?? null,
      lastSeen: device.lastSeen ?? null,
    }));

    return successResponse({
      data,
      count: data.length,
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
