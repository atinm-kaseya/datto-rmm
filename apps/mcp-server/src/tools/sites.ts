import type { DattoClient } from 'datto-rmm-api';
import { normalizePagination } from '../utils/pagination.js';
import { handleResponse, handleVoidResponse, successResponse, errorResponse, mapApiError, extractPageMeta, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Get site details by UID.
 */
export async function getSite(client: DattoClient, args: { siteUid: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/site/{siteUid}', {
      params: {
        path: { siteUid: args.siteUid },
      },
    });
    const data = handleResponse<T.Site>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List devices in a site.
 */
export async function listSiteDevices(
  client: DattoClient,
  args: { siteUid: string; page?: number; max?: number; filterId?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

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
    return successResponse({ data: page.devices ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List open alerts for a site.
 */
export async function listSiteOpenAlerts(
  client: DattoClient,
  args: { siteUid: string; page?: number; max?: number; muted?: boolean }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/site/{siteUid}/alerts/open', {
      params: {
        path: { siteUid: args.siteUid },
        query: {
          page: pagination.page,
          max: pagination.max,
          muted: args.muted,
        },
      },
    });
    const page = handleResponse<T.AlertsPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.alerts ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List resolved alerts for a site.
 */
export async function listSiteResolvedAlerts(
  client: DattoClient,
  args: { siteUid: string; page?: number; max?: number; muted?: boolean }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/site/{siteUid}/alerts/resolved', {
      params: {
        path: { siteUid: args.siteUid },
        query: {
          page: pagination.page,
          max: pagination.max,
          muted: args.muted,
        },
      },
    });
    const page = handleResponse<T.AlertsPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.alerts ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List site variables.
 */
export async function listSiteVariables(
  client: DattoClient,
  args: { siteUid: string; page?: number; max?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/site/{siteUid}/variables', {
      params: {
        path: { siteUid: args.siteUid },
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
 * Get site settings.
 */
export async function getSiteSettings(client: DattoClient, args: { siteUid: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/site/{siteUid}/settings', {
      params: {
        path: { siteUid: args.siteUid },
      },
    });
    const data = handleResponse<T.SiteSettings>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * List site device filters.
 */
export async function listSiteFilters(
  client: DattoClient,
  args: { siteUid: string; page?: number; max?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/site/{siteUid}/filters', {
      params: {
        path: { siteUid: args.siteUid },
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
 * Create a new site.
 */
export async function createSite(
  client: DattoClient,
  args: {
    name: string;
    description?: string;
    notes?: string;
    onDemand?: boolean;
    splashtopAutoInstall?: boolean;
  }
): Promise<ToolResult> {
  try {
    // Duplicate check: look for an existing site with the same name
    const checkRes = await client.GET('/v2/account/sites', {
      params: { query: { siteName: args.name, max: 1 } },
    });
    const existing = handleResponse<T.SitesPage>(checkRes);
    const match = (existing.sites ?? []).find(
      (s) => s.name?.toLowerCase() === args.name.toLowerCase()
    );
    if (match) {
      return errorResponse({
        error: 'duplicate_detected',
        detail: `Site "${args.name}" already exists (uid: ${match.uid})`,
        code: 409,
      });
    }

    const response = await client.PUT('/v2/site', {
      body: {
        name: args.name,
        description: args.description,
        notes: args.notes,
        onDemand: args.onDemand,
        splashtopAutoInstall: args.splashtopAutoInstall,
      },
    });
    const data = handleResponse<T.Site>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Update a site.
 */
export async function updateSite(
  client: DattoClient,
  args: {
    siteUid: string;
    name: string;
    description?: string;
    notes?: string;
    onDemand?: boolean;
    splashtopAutoInstall?: boolean;
  }
): Promise<ToolResult> {
  try {
    const response = await client.POST('/v2/site/{siteUid}', {
      params: {
        path: { siteUid: args.siteUid },
      },
      body: {
        name: args.name,
        description: args.description,
        notes: args.notes,
        onDemand: args.onDemand,
        splashtopAutoInstall: args.splashtopAutoInstall,
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
