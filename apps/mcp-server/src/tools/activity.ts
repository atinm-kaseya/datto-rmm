import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, extractPageMeta, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Get activity logs.
 */
export async function getActivityLogs(
  client: DattoClient,
  args: {
    size?: number;
    order?: 'asc' | 'desc';
    from?: string;
    until?: string;
    entities?: ('device' | 'user')[];
    categories?: string[];
    actions?: string[];
    siteIds?: number[];
    userIds?: number[];
  }
): Promise<ToolResult> {
  try {
    // The API expects a single entity value, not an array
    // If multiple entities are provided, we'll use the first one
    const entity = args.entities?.[0] as 'device' | 'user' | undefined;

    const response = await client.GET('/v2/activity-logs', {
      params: {
        query: {
          size: args.size,
          order: args.order,
          from: args.from,
          until: args.until,
          entities: entity,
          categories: args.categories,
          actions: args.actions,
          siteIds: args.siteIds,
          userIds: args.userIds,
        },
      },
    });
    const page = handleResponse<T.ActivityLogsPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.activities ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
