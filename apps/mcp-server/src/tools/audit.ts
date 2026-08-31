import type { DattoClient } from 'datto-rmm-api';
import { normalizePagination } from '../utils/pagination.js';
import { handleResponse, successResponse, errorResponse, mapApiError, extractPageMeta, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Get device audit data.
 */
export async function getDeviceAudit(client: DattoClient, args: { deviceUid: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/audit/device/{deviceUid}', {
      params: {
        path: { deviceUid: args.deviceUid },
      },
    });
    const data = handleResponse<T.DeviceAudit>(response);
    return successResponse({ data, _enhanced: {} });
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
 * Get ESXi host audit data.
 */
export async function getEsxiAudit(client: DattoClient, args: { deviceUid: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/audit/esxihost/{deviceUid}', {
      params: {
        path: { deviceUid: args.deviceUid },
      },
    });
    const data = handleResponse<T.ESXiHostAudit>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get printer audit data.
 */
export async function getPrinterAudit(client: DattoClient, args: { deviceUid: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/audit/printer/{deviceUid}', {
      params: {
        path: { deviceUid: args.deviceUid },
      },
    });
    const data = handleResponse<T.PrinterAudit>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
