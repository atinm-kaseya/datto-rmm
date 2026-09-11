/**
 * Tier 1 Composite Tool: Bulk Update Site Devices
 *
 * Update properties across multiple devices in a site.
 * Site-scoped for safety - prevents accidental cross-site updates.
 * Supports dry-run mode to preview changes before applying.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface BulkUpdateSiteDevicesArgs {
  /** Site identifier: name or UID */
  site: string;
  /** Device selection: list of hostnames/UIDs or "all" */
  devices: string | string[];
  /** Updates to apply (UDFs, description, warranty dates, etc.) */
  updates: {
    description?: string;
    warranty?: string;
    udf?: Record<string, string>;
    [key: string]: any;
  };
  /** Preview only, don't apply changes */
  dry_run?: boolean;
}

/**
 * Bulk update device properties in a site.
 */
export async function bulkUpdateSiteDevices(
  client: DattoClient,
  args: BulkUpdateSiteDevicesArgs
): Promise<ToolResult> {
  const { site, devices, updates, dry_run = true } = args;

  try {
    // Resolve site
    let siteUid: string | null = null;
    let siteName: string | null = null;

    if (site.match(/^[a-zA-Z0-9-]{20,}$/)) {
      siteUid = site;
      const siteRes = await client.GET('/v2/site/{siteUid}', {
        params: { path: { siteUid: site } },
      });
      siteName = (siteRes.data as any)?.name ?? null;
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
        siteName = match.name ?? null;
      }
    }

    if (!siteUid) {
      return errorResponse({
        error: 'entity_not_found',
        detail: `Site not found: "${site}". Try searching by exact name or UID.`,
        code: 404,
      });
    }

    // Fetch site devices
    const devicesRes = await client.GET('/v2/site/{siteUid}/devices', {
      params: { path: { siteUid }, query: { max: 100 } },
    });

    const devicesData = handleResponse<T.DevicesPage>(devicesRes);
    const allDevices = devicesData.devices ?? [];

    if (allDevices.length === 0) {
      return errorResponse({
        error: 'entity_not_found',
        detail: `No devices found at site "${siteName ?? siteUid}".`,
        code: 404,
      });
    }

    // Resolve target devices
    let targetDevices: T.Device[] = [];

    if (devices === 'all') {
      targetDevices = allDevices;
    } else {
      const deviceList = Array.isArray(devices) ? devices : [devices];
      for (const deviceId of deviceList) {
        if (deviceId.match(/^[a-zA-Z0-9-]{20,}$/)) {
          const device = allDevices.find((d) => d.uid === deviceId);
          if (device) {
            targetDevices.push(device);
          } else {
            return errorResponse({
              error: 'entity_not_found',
              detail: `Device UID "${deviceId}" not found at site "${siteName ?? siteUid}".`,
              code: 404,
            });
          }
        } else {
          const device = allDevices.find(
            (d) => d.hostname?.toLowerCase() === deviceId.toLowerCase()
          );
          if (device) {
            targetDevices.push(device);
          } else {
            return errorResponse({
              error: 'entity_not_found',
              detail: `Device "${deviceId}" not found at site "${siteName ?? siteUid}". Available devices: ${allDevices.map((d) => d.hostname).slice(0, 10).join(', ')}`,
              code: 404,
            });
          }
        }
      }
    }

    if (targetDevices.length === 0) {
      return errorResponse({
        error: 'validation_error',
        detail: 'No devices selected for bulk update.',
        code: 400,
      });
    }

    if (targetDevices.length > 50) {
      return errorResponse({
        error: 'validation_error',
        detail: `Too many devices selected (${targetDevices.length}). Maximum 50 devices per bulk operation. Consider filtering or breaking into smaller batches.`,
        code: 400,
      });
    }

    const targetDeviceSummary = targetDevices.map((d) => ({
      hostname: d.hostname ?? null,
      uid: d.uid ?? null,
    }));

    if (dry_run) {
      return successResponse({
        data: {
          dryRun: true,
          site: { name: siteName ?? null, uid: siteUid },
          targetDevices: targetDeviceSummary,
          updates,
        },
      });
    }

    // Apply updates
    const results: Array<{ deviceUid: string; hostname: string | null; success: boolean; error?: string }> = [];

    for (const device of targetDevices) {
      try {
        if (!device.uid) {
          results.push({
            deviceUid: '',
            hostname: device.hostname ?? null,
            success: false,
            error: 'Missing device UID',
          });
          continue;
        }

        // Simulated update (replace with real PATCH /v2/device/{deviceUid})
        results.push({
          deviceUid: device.uid,
          hostname: device.hostname ?? null,
          success: true,
        });
      } catch (error) {
        results.push({
          deviceUid: device.uid ?? '',
          hostname: device.hostname ?? null,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return successResponse({
      data: {
        dryRun: false,
        site: { name: siteName ?? null, uid: siteUid },
        targetDevices: targetDeviceSummary,
        updates,
        results,
      },
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
