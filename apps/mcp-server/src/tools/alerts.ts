import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, handleVoidResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Get alert by UID.
 */
export async function getAlert(client: DattoClient, args: { alertUid: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/alert/{alertUid}', {
      params: {
        path: { alertUid: args.alertUid },
      },
    });
    const data = handleResponse<T.Alert>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Resolve an alert.
 */
export async function resolveAlert(client: DattoClient, args: { alertUid: string }): Promise<ToolResult> {
  try {
    const response = await client.POST('/v2/alert/{alertUid}/resolve', {
      params: {
        path: { alertUid: args.alertUid },
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
