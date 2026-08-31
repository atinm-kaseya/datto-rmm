import type { DattoClient } from 'datto-rmm-api';
import { normalizePagination } from '../utils/pagination.js';
import { handleResponse, successResponse, errorResponse, mapApiError, extractPageMeta, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * List default device filters.
 */
export async function listDefaultFilters(
  client: DattoClient,
  args: { page?: number; max?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/filter/default-filters', {
      params: {
        query: {
          page: pagination.page,
          max: pagination.max,
        },
      },
    });
    const page = handleResponse<T.FiltersPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.filters ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List custom device filters.
 */
export async function listCustomFilters(
  client: DattoClient,
  args: { page?: number; max?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/filter/custom-filters', {
      params: {
        query: {
          page: pagination.page,
          max: pagination.max,
        },
      },
    });
    const page = handleResponse<T.FiltersPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.filters ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
