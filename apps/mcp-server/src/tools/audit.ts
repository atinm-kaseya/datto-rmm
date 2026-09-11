import type { DattoClient } from 'datto-rmm-api';
import { normalizePagination } from '../utils/pagination.js';
import { handleResponse, successResponse, errorResponse, mapApiError, extractPageMeta, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Get device audit data, automatically routing by device class.
 * Fetches the device first to determine its class, then calls the appropriate audit endpoint.
 */
export async function getDeviceAudit(client: DattoClient, args: { deviceUid: string }): Promise<ToolResult> {
  try {
    // Fetch the device to determine its class
    const deviceResponse = await client.GET('/v2/device/{deviceUid}', {
      params: {
        path: { deviceUid: args.deviceUid },
      },
    });
    const device = handleResponse<T.Device>(deviceResponse);
    const deviceClass = device.deviceClass;

    if (deviceClass === 'esxihost') {
      const response = await client.GET('/v2/audit/esxihost/{deviceUid}', {
        params: {
          path: { deviceUid: args.deviceUid },
        },
      });
      const data = handleResponse<T.ESXiHostAudit>(response);
      return successResponse({ data, _enhanced: {} });
    } else if (deviceClass === 'printer') {
      const response = await client.GET('/v2/audit/printer/{deviceUid}', {
        params: {
          path: { deviceUid: args.deviceUid },
        },
      });
      const data = handleResponse<T.PrinterAudit>(response);
      return successResponse({ data, _enhanced: {} });
    } else {
      const response = await client.GET('/v2/audit/device/{deviceUid}', {
        params: {
          path: { deviceUid: args.deviceUid },
        },
      });
      const data = handleResponse<T.DeviceAudit>(response);
      return successResponse({ data, _enhanced: {} });
    }
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get device software list.
 */
export async function getDeviceSoftware(
  client: DattoClient,
  args: { deviceUid: string; page?: number; max?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/audit/device/{deviceUid}/software', {
      params: {
        path: { deviceUid: args.deviceUid },
        query: {
          page: pagination.page,
          max: pagination.max,
        },
      },
    });
    const page = handleResponse<T.SoftwarePage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.software ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get device audit by MAC address.
 */
export async function getDeviceAuditByMac(client: DattoClient, args: { macAddress: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/audit/device/macAddress/{macAddress}', {
      params: {
        path: { macAddress: args.macAddress },
      },
    });
    const data = handleResponse<T.DeviceAudit[]>(response);
    return successResponse({ data, count: data.length, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List patches for a device or site.
 * Exactly one of deviceUid or siteUid must be provided.
 */
export async function listPatches(
  client: DattoClient,
  args: {
    deviceUid?: string;
    siteUid?: string;
    installStatus?: 'INSTALLED' | 'APPROVED_PENDING' | 'NOT_APPROVED';
    page?: number;
    max?: number;
  }
): Promise<ToolResult> {
  if (!args.deviceUid && !args.siteUid) {
    return errorResponse({ error: 'validation_error', detail: 'Either deviceUid or siteUid is required', code: 400 });
  }
  if (args.deviceUid && args.siteUid) {
    return errorResponse({ error: 'validation_error', detail: 'deviceUid and siteUid are mutually exclusive', code: 400 });
  }
  type PatchesPage = { patches?: unknown[]; pageDetails?: { count?: number; nextPageUrl?: string | null } | null };
  type RawGet = (path: string, opts?: unknown) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
  const rawGet = client.GET as unknown as RawGet;
  try {
    const pagination = normalizePagination(args);
    if (args.deviceUid) {
      const response = await rawGet('/v2/device/{deviceUid}/patches', {
        params: {
          path: { deviceUid: args.deviceUid },
          query: { page: pagination.page, max: pagination.max, installStatus: args.installStatus },
        },
      });
      const page = handleResponse<PatchesPage>(response);
      const { count, next_page } = extractPageMeta(page);
      return successResponse({ data: page.patches ?? [], count, next_page, _enhanced: {} });
    } else {
      const response = await rawGet('/v2/site/{siteUid}/patches', {
        params: {
          path: { siteUid: args.siteUid! },
          query: { page: pagination.page, max: pagination.max, installStatus: args.installStatus },
        },
      });
      const page = handleResponse<PatchesPage>(response);
      const { count, next_page } = extractPageMeta(page);
      return successResponse({ data: page.patches ?? [], count, next_page, _enhanced: {} });
    }
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
