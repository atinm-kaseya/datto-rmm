/**
 * Tier 1 Composite Tool: Get Site Health
 *
 * Complete site health dashboard - primary entry point for site-focused work.
 * Shows everything you need to know about a site in one call.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface GetSiteHealthArgs {
  /** Site identifier: name or UID */
  site: string;
  /** Include full device list vs summary */
  include_device_details?: boolean;
}

/**
 * Get comprehensive site health snapshot.
 */
export async function getSiteHealth(
  client: DattoClient,
  args: GetSiteHealthArgs
): Promise<ToolResult> {
  const { site, include_device_details = false } = args;

  try {
    const siteUid = await resolveSiteIdentifier(client, site);
    if (!siteUid) {
      return errorResponse({
        error: 'entity_not_found',
        detail: `Site not found: "${site}". Try searching by exact name or UID.`,
        code: 404,
      });
    }

    const [siteRes, devicesRes, alertsRes] = await Promise.all([
      client.GET('/v2/site/{siteUid}', {
        params: { path: { siteUid } },
      }),
      client.GET('/v2/site/{siteUid}/devices', {
        params: { path: { siteUid }, query: { max: 250 } },
      }),
      client.GET('/v2/site/{siteUid}/alerts/open', {
        params: { path: { siteUid }, query: { max: 250 } },
      }),
    ]);

    const siteInfo = handleResponse<T.Site>(siteRes);
    const devicesData = handleResponse<T.DevicesPage>(devicesRes);
    const alertsData = handleResponse<T.AlertsPage>(alertsRes);

    const devices = devicesData.devices ?? [];
    const alerts = alertsData.alerts ?? [];

    const onlineDevices = devices.filter((d) => d.online).length;
    const offlineDevices = devices.length - onlineDevices;

    const criticalAlerts = alerts.filter((a) => a.priority === 'Critical').length;
    const warningAlerts = alerts.filter(
      (a) => a.priority === 'High' || a.priority === 'Moderate'
    ).length;

    // Find top devices with most alerts
    const alertsByDevice = new Map<string, number>();
    for (const alert of alerts) {
      const deviceUid = alert.alertSourceInfo?.deviceUid || 'unknown';
      alertsByDevice.set(deviceUid, (alertsByDevice.get(deviceUid) || 0) + 1);
    }

    const topProblematicDevices = Array.from(alertsByDevice.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([deviceUid, alertCount]) => {
        const device = devices.find((d) => d.uid === deviceUid);
        return {
          hostname: device?.hostname ?? 'Unknown',
          uid: deviceUid,
          alertCount,
          online: device?.online ?? false,
        };
      });

    const recommendations: string[] = [];
    if (offlineDevices > 0) {
      recommendations.push(
        `Check offline devices: use rmm_list_site_devices with status=offline on site ${siteUid}`
      );
    }
    if (topProblematicDevices.length > 0 && topProblematicDevices[0]) {
      recommendations.push(
        `Investigate top device: use rmm_get_device_health on ${topProblematicDevices[0].hostname} (${topProblematicDevices[0].uid})`
      );
    }
    if (criticalAlerts > 5) {
      recommendations.push(
        `Alert analysis: use rmm_get_site_alerts for grouped view on site ${siteUid}`
      );
    }

    const result: Record<string, unknown> = {
      site: {
        name: siteInfo.name ?? 'Unknown Site',
        uid: siteUid,
        totalDevices: devices.length,
        onlineDevices,
        offlineDevices,
      },
      alerts: {
        total: alerts.length,
        critical: criticalAlerts,
        warning: warningAlerts,
      },
      topProblematicDevices,
      recommendations,
    };

    if (include_device_details) {
      const sortedDevices = [...devices]
        .sort((a, b) => {
          if (a.online !== b.online) return a.online ? 1 : -1;
          const aAlerts = alertsByDevice.get(a.uid || '') || 0;
          const bAlerts = alertsByDevice.get(b.uid || '') || 0;
          if (aAlerts !== bAlerts) return bAlerts - aAlerts;
          return (a.hostname || '').localeCompare(b.hostname || '');
        })
        .slice(0, 20)
        .map((d) => ({
          hostname: d.hostname ?? null,
          uid: d.uid ?? null,
          online: d.online ?? false,
          deviceType: d.deviceType?.type ?? null,
          alertCount: alertsByDevice.get(d.uid || '') || 0,
          internalIp: d.intIpAddress ?? null,
          lastSeen: d.lastSeen ?? null,
        }));
      result['deviceDetails'] = sortedDevices;
    }

    return successResponse({ data: result });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Resolve site identifier (name or UID) to UID.
 */
async function resolveSiteIdentifier(
  client: DattoClient,
  identifier: string
): Promise<string | null> {
  if (identifier.match(/^[a-f0-9-]{36}$/i)) {
    return identifier;
  }

  const response = await client.GET('/v2/account/sites', {
    params: {
      query: {
        siteName: identifier,
        max: 250,
      },
    },
  });

  if (response.error) {
    return null;
  }

  const sitesData = handleResponse<T.SitesPage>(response);
  const sites = sitesData.sites ?? [];

  const exactMatch = sites.find(
    (s) => s.name?.toLowerCase() === identifier.toLowerCase()
  );

  if (exactMatch?.uid) {
    return exactMatch.uid;
  }

  return sites.length > 0 && sites[0]?.uid ? sites[0].uid : null;
}
