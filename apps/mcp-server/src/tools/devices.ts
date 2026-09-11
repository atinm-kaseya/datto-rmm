import type { DattoClient } from 'datto-rmm-api';
import { normalizePagination } from '../utils/pagination.js';
import { handleResponse, handleVoidResponse, successResponse, errorResponse, mapApiError, extractPageMeta, buildEnhanced, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Get device by UID.
 */
export async function getDevice(client: DattoClient, args: { deviceUid: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/device/{deviceUid}', {
      params: {
        path: { deviceUid: args.deviceUid },
      },
    });
    const data = handleResponse<T.Device>(response);
    return successResponse({ data, _enhanced: buildEnhanced(data) });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get device by ID (numeric).
 */
export async function getDeviceById(client: DattoClient, args: { deviceId: number }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/device/id/{deviceId}', {
      params: {
        path: { deviceId: args.deviceId },
      },
    });
    const data = handleResponse<T.Device>(response);
    return successResponse({ data, _enhanced: buildEnhanced(data) });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get device by MAC address.
 */
export async function getDeviceByMac(client: DattoClient, args: { macAddress: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/device/macAddress/{macAddress}', {
      params: {
        path: { macAddress: args.macAddress },
      },
    });
    const data = handleResponse<T.Device[]>(response);
    return successResponse({ data, count: data.length, _enhanced: buildEnhanced(data) });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get device open alerts.
 */
export async function listDeviceOpenAlerts(
  client: DattoClient,
  args: { deviceUid: string; page?: number; max?: number; muted?: boolean }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/device/{deviceUid}/alerts/open', {
      params: {
        path: { deviceUid: args.deviceUid },
        query: {
          page: pagination.page,
          max: pagination.max,
          muted: args.muted,
        },
      },
    });
    const page = handleResponse<T.AlertsPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.alerts ?? [], count, next_page, _enhanced: buildEnhanced(page.alerts ?? []) });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get device resolved alerts.
 */
export async function listDeviceResolvedAlerts(
  client: DattoClient,
  args: { deviceUid: string; page?: number; max?: number; muted?: boolean }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/device/{deviceUid}/alerts/resolved', {
      params: {
        path: { deviceUid: args.deviceUid },
        query: {
          page: pagination.page,
          max: pagination.max,
          muted: args.muted,
        },
      },
    });
    const page = handleResponse<T.AlertsPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.alerts ?? [], count, next_page, _enhanced: buildEnhanced(page.alerts ?? []) });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Move device to another site.
 */
export async function moveDevice(
  client: DattoClient,
  args: { deviceUid: string; siteUid: string }
): Promise<ToolResult> {
  try {
    const response = await client.PUT('/v2/device/{deviceUid}/site/{siteUid}', {
      params: {
        path: {
          deviceUid: args.deviceUid,
          siteUid: args.siteUid,
        },
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Run a quick job on a device.
 */
export async function runJob(
  client: DattoClient,
  args: {
    deviceUid: string;
    componentUid: string;
    variables?: Array<{ name: string; value: string }>;
  }
): Promise<ToolResult> {
  try {
    const response = await client.PUT('/v2/device/{deviceUid}/quickjob', {
      params: {
        path: { deviceUid: args.deviceUid },
      },
      body: {
        jobComponent: {
          componentUid: args.componentUid,
          variables: args.variables,
        },
      } as any,
    });
    const data = handleResponse<T.CreateQuickJobResponse>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Set device user-defined fields (UDF).
 */
export async function setDeviceUdf(
  client: DattoClient,
  args: {
    deviceUid: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    udf6?: string;
    udf7?: string;
    udf8?: string;
    udf9?: string;
    udf10?: string;
    udf11?: string;
    udf12?: string;
    udf13?: string;
    udf14?: string;
    udf15?: string;
    udf16?: string;
    udf17?: string;
    udf18?: string;
    udf19?: string;
    udf20?: string;
    udf21?: string;
    udf22?: string;
    udf23?: string;
    udf24?: string;
    udf25?: string;
    udf26?: string;
    udf27?: string;
    udf28?: string;
    udf29?: string;
    udf30?: string;
  }
): Promise<ToolResult> {
  try {
    const { deviceUid, ...udfFields } = args;

    const response = await client.POST('/v2/device/{deviceUid}/udf', {
      params: {
        path: { deviceUid },
      },
      body: udfFields,
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Set device warranty date.
 */
export async function setDeviceWarranty(
  client: DattoClient,
  args: { deviceUid: string; warrantyDate?: string }
): Promise<ToolResult> {
  try {
    const response = await client.POST('/v2/device/{deviceUid}/warranty', {
      params: {
        path: { deviceUid: args.deviceUid },
      },
      body: {
        warrantyDate: args.warrantyDate,
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
