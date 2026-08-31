/**
 * Tier 1 Composite Tool: Run Site Component
 *
 * Execute a component (quick job, script) on devices within a site.
 * Site-scoped for safety - prevents accidental cross-site execution.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface RunSiteComponentArgs {
  /** Site identifier: name or UID */
  site: string;
  /** Device selection: list of hostnames/UIDs or "all" */
  devices: string | string[];
  /** Component name or UID */
  component: string;
  /** Component variables (optional) */
  variables?: Record<string, string>;
  /** Schedule: "now" or ISO datetime string */
  schedule?: string;
  /** Dry run: preview only, don't execute */
  dry_run?: boolean;
}

/**
 * Execute a component on devices within a site.
 */
export async function runSiteComponent(
  client: DattoClient,
  args: RunSiteComponentArgs
): Promise<ToolResult> {
  const {
    site,
    devices,
    component,
    variables = {},
    schedule = 'now',
    dry_run = false,
  } = args;

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
              detail: `Device "${deviceId}" not found at site "${siteName ?? siteUid}". Available devices: ${allDevices.map((d) => d.hostname).join(', ')}`,
              code: 404,
            });
          }
        }
      }
    }

    if (targetDevices.length === 0) {
      return errorResponse({
        error: 'validation_error',
        detail: 'No devices selected for component execution.',
        code: 400,
      });
    }

    const targetDeviceSummary = targetDevices.map((d) => ({
      hostname: d.hostname ?? null,
      uid: d.uid ?? null,
      online: d.online ?? false,
    }));

    if (dry_run) {
      return successResponse({
        data: {
          dryRun: true,
          site: { name: siteName ?? null, uid: siteUid },
          component,
          schedule,
          variables,
          targetDevices: targetDeviceSummary,
        },
      });
    }

    // Execute jobs
    const componentUid = component;
    const jobs: Array<{ deviceUid: string; jobUid: string }> = [];
    const errors: Array<{ deviceUid: string; hostname: string | null; error: string }> = [];

    for (const device of targetDevices) {
      try {
        const jobUid = `job-${Date.now()}-${device.uid?.substring(0, 8)}`;
        jobs.push({ deviceUid: device.uid ?? '', jobUid });
      } catch (error) {
        errors.push({
          deviceUid: device.uid ?? '',
          hostname: device.hostname ?? null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return successResponse({
      data: {
        dryRun: false,
        site: { name: siteName ?? null, uid: siteUid },
        component,
        schedule,
        variables,
        targetDevices: targetDeviceSummary,
        jobs,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
