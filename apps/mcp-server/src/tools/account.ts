import type { DattoClient } from 'datto-rmm-api';
import { normalizePagination } from '../utils/pagination.js';
import { handleResponse, successResponse, errorResponse, mapApiError, extractPageMeta, buildEnhanced, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Get account information.
 */
export async function getAccount(client: DattoClient): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/account');
    const data = handleResponse<T.Account>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List all sites in the account.
 */
export async function listSites(
  client: DattoClient,
  args: { page?: number; max?: number; siteName?: string }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/account/sites', {
      params: {
        query: {
          page: pagination.page,
          max: pagination.max,
          siteName: args.siteName,
        },
      },
    });

    const page = handleResponse<T.SitesPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.sites ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List all devices in the account, or devices in a specific site if siteUid is provided.
 */
export async function listDevices(
  client: DattoClient,
  args: {
    page?: number;
    max?: number;
    hostname?: string;
    siteName?: string;
    deviceType?: string;
    operatingSystem?: string;
    filterId?: number;
    siteUid?: string;
  }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    if (args.siteUid) {
      const response = await client.GET('/v2/site/{siteUid}/devices', {
        params: {
          path: { siteUid: args.siteUid },
          query: {
            page: pagination.page,
            max: pagination.max,
            filterId: args.filterId,
          },
        },
      });
      const page = handleResponse<T.DevicesPage>(response);
      const { count, next_page } = extractPageMeta(page);
      return successResponse({ data: page.devices ?? [], count, next_page, _enhanced: buildEnhanced(page.devices ?? []) });
    }

    const response = await client.GET('/v2/account/devices', {
      params: {
        query: {
          page: pagination.page,
          max: pagination.max,
          hostname: args.hostname,
          siteName: args.siteName,
          deviceType: args.deviceType,
          operatingSystem: args.operatingSystem,
          filterId: args.filterId,
        },
      },
    });
    const page = handleResponse<T.DevicesPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.devices ?? [], count, next_page, _enhanced: buildEnhanced(page.devices ?? []) });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List users in the account.
 */
export async function listUsers(
  client: DattoClient,
  args: { page?: number; max?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/account/users', {
      params: {
        query: {
          page: pagination.page,
          max: pagination.max,
        },
      },
    });
    const page = handleResponse<T.UsersPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.users ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List account variables.
 */
export async function listAccountVariables(
  client: DattoClient,
  args: { page?: number; max?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/account/variables', {
      params: {
        query: {
          page: pagination.page,
          max: pagination.max,
        },
      },
    });
    const page = handleResponse<T.VariablesPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.variables ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List available components.
 */
export async function listComponents(
  client: DattoClient,
  args: { page?: number; max?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/account/components', {
      params: {
        query: {
          page: pagination.page,
          max: pagination.max,
        },
      },
    });
    const page = handleResponse<T.ComponentsPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.components ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List alerts with flexible routing by status, site, and device.
 */
export async function listAlerts(
  client: DattoClient,
  args: {
    status?: 'open' | 'resolved';
    siteUid?: string;
    deviceUid?: string;
    page?: number;
    max?: number;
    muted?: boolean;
  }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);
    const isResolved = args.status === 'resolved';

    let response: Awaited<ReturnType<DattoClient['GET']>>;

    if (args.deviceUid) {
      // Device-scoped alerts take precedence
      if (isResolved) {
        response = await client.GET('/v2/device/{deviceUid}/alerts/resolved', {
          params: {
            path: { deviceUid: args.deviceUid },
            query: { page: pagination.page, max: pagination.max, muted: args.muted },
          },
        });
      } else {
        response = await client.GET('/v2/device/{deviceUid}/alerts/open', {
          params: {
            path: { deviceUid: args.deviceUid },
            query: { page: pagination.page, max: pagination.max, muted: args.muted },
          },
        });
      }
    } else if (args.siteUid) {
      if (isResolved) {
        response = await client.GET('/v2/site/{siteUid}/alerts/resolved', {
          params: {
            path: { siteUid: args.siteUid },
            query: { page: pagination.page, max: pagination.max, muted: args.muted },
          },
        });
      } else {
        response = await client.GET('/v2/site/{siteUid}/alerts/open', {
          params: {
            path: { siteUid: args.siteUid },
            query: { page: pagination.page, max: pagination.max, muted: args.muted },
          },
        });
      }
    } else {
      if (isResolved) {
        response = await client.GET('/v2/account/alerts/resolved', {
          params: {
            query: { page: pagination.page, max: pagination.max, muted: args.muted },
          },
        });
      } else {
        response = await client.GET('/v2/account/alerts/open', {
          params: {
            query: { page: pagination.page, max: pagination.max, muted: args.muted },
          },
        });
      }
    }

    const page = handleResponse<T.AlertsPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.alerts ?? [], count, next_page, _enhanced: buildEnhanced(page.alerts ?? []) });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get API call metering summary for the account.
 * This endpoint is not in the OpenAPI spec; use `as never` to bypass path typing.
 */
export async function getMeteringSummary(
  client: DattoClient,
  args: { origin?: string }
): Promise<ToolResult> {
  try {
    type RawGet = (path: string, opts?: { params?: { query?: Record<string, string | undefined> } }) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
    const rawGet = client.GET as unknown as RawGet;
    const response = await rawGet('/v2/metering/summary', {
      params: { query: args.origin ? { origin: args.origin } : undefined },
    });

    const data = handleResponse<Record<string, unknown>>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

