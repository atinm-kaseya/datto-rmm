import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, successResponse, errorResponse, mapApiError, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * List activity logs with optional filtering and cursor-based pagination.
 *
 * Pass `cursor` (the `next_page` value from a previous response) to fetch the
 * next page. The cursor is the full nextPageUrl returned by the API — we
 * extract searchAfter and page direction from it automatically.
 */
export async function listActivityLogs(
  client: DattoClient,
  args: {
    size?: number;
    order?: 'asc' | 'desc';
    from?: string;
    until?: string;
    entity?: 'device' | 'user';
    categories?: string[];
    actions?: string[];
    siteIds?: number[];
    userIds?: number[];
    cursor?: string;
  }
): Promise<ToolResult> {
  try {
    let searchAfter: string[] | undefined;
    let pageDirection: 'next' | 'previous' | undefined;

    if (args.cursor) {
      try {
        const url = new URL(args.cursor);
        const sa = url.searchParams.get('searchAfter');
        if (sa) searchAfter = [sa];
        const pd = url.searchParams.get('page');
        if (pd === 'next' || pd === 'previous') pageDirection = pd;
      } catch {
        return errorResponse({ error: 'validation_error', detail: 'cursor is not a valid URL', code: 400 });
      }
    }

    const response = await client.GET('/v2/activity-logs', {
      params: {
        query: {
          size: args.size,
          order: args.order,
          from: args.cursor ? undefined : args.from,
          until: args.cursor ? undefined : args.until,
          entities: args.entity,
          categories: args.cursor ? undefined : args.categories,
          actions: args.cursor ? undefined : args.actions,
          siteIds: args.cursor ? undefined : args.siteIds,
          userIds: args.cursor ? undefined : args.userIds,
          searchAfter,
          page: pageDirection,
        },
      },
    });

    const page = handleResponse<T.ActivityLogsPage>(response);
    // totalCount is the full matching set; count is just the current page size
    const count = page.pageDetails?.totalCount ?? page.pageDetails?.count ?? 0;
    const next_page = page.pageDetails?.nextPageUrl ?? null;

    return successResponse({ data: page.activities ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
