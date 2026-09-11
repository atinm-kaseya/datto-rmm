import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Get system status.
 */
export async function getSystemStatus(client: DattoClient): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/system/status');
    const data = handleResponse<T.StatusResponse>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get rate limit status.
 */
export async function getRateLimit(client: DattoClient): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/system/request_rate');
    const data = handleResponse<T.RateStatusResponse>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get pagination configuration.
 */
export async function getPaginationConfig(client: DattoClient): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/system/pagination');
    const data = handleResponse<T.PaginationConfiguration>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
