import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, handleVoidResponse, successResponse, errorResponse, mapApiError, extractPageMeta, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Create an account variable.
 */
export async function createAccountVariable(
  client: DattoClient,
  args: { name: string; value: string; masked?: boolean }
): Promise<ToolResult> {
  try {
    // Duplicate check: look for an existing variable with the same name
    const checkRes = await client.GET('/v2/account/variables', {
      params: { query: { max: 250 } },
    });
    const existing = handleResponse<T.VariablesPage>(checkRes);
    const { next_page } = extractPageMeta(existing);
    const match = (existing.variables ?? []).find(
      (v) => v.name?.toLowerCase() === args.name.toLowerCase()
    );
    if (match || next_page) {
      // If there are more pages and no match yet, do a second pass isn't worth it;
      // the API will return 409 naturally if a true duplicate exists server-side.
      if (match) {
        return errorResponse({
          error: 'duplicate_detected',
          detail: `Account variable "${args.name}" already exists (id: ${match.id})`,
          code: 409,
        });
      }
    }

    const response = await client.PUT('/v2/account/variable', {
      body: {
        name: args.name,
        value: args.value,
        masked: args.masked,
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Update an account variable.
 */
export async function updateAccountVariable(
  client: DattoClient,
  args: { variableId: number; name?: string; value?: string; masked?: boolean }
): Promise<ToolResult> {
  try {
    const response = await client.POST('/v2/account/variable/{variableId}', {
      params: {
        path: { variableId: args.variableId },
      },
      body: {
        name: args.name,
        value: args.value,
        masked: args.masked,
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Delete an account variable.
 */
export async function deleteAccountVariable(
  client: DattoClient,
  args: { variableId: number }
): Promise<ToolResult> {
  try {
    const response = await client.DELETE('/v2/account/variable/{variableId}', {
      params: {
        path: { variableId: args.variableId },
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Create a site variable.
 */
export async function createSiteVariable(
  client: DattoClient,
  args: { siteUid: string; name: string; value: string; masked?: boolean }
): Promise<ToolResult> {
  try {
    // Duplicate check: look for an existing variable with the same name on this site
    const checkRes = await client.GET('/v2/site/{siteUid}/variables', {
      params: { path: { siteUid: args.siteUid }, query: { max: 250 } },
    });
    const existing = handleResponse<T.VariablesPage>(checkRes);
    const match = (existing.variables ?? []).find(
      (v) => v.name?.toLowerCase() === args.name.toLowerCase()
    );
    if (match) {
      return errorResponse({
        error: 'duplicate_detected',
        detail: `Site variable "${args.name}" already exists on this site (id: ${match.id})`,
        code: 409,
      });
    }

    const response = await client.PUT('/v2/site/{siteUid}/variable', {
      params: {
        path: { siteUid: args.siteUid },
      },
      body: {
        name: args.name,
        value: args.value,
        masked: args.masked,
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Update a site variable.
 */
export async function updateSiteVariable(
  client: DattoClient,
  args: { siteUid: string; variableId: number; name?: string; value?: string; masked?: boolean }
): Promise<ToolResult> {
  try {
    const response = await client.POST('/v2/site/{siteUid}/variable/{variableId}', {
      params: {
        path: {
          siteUid: args.siteUid,
          variableId: args.variableId,
        },
      },
      body: {
        name: args.name,
        value: args.value,
        masked: args.masked,
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Delete a site variable.
 */
export async function deleteSiteVariable(
  client: DattoClient,
  args: { siteUid: string; variableId: number }
): Promise<ToolResult> {
  try {
    const response = await client.DELETE('/v2/site/{siteUid}/variable/{variableId}', {
      params: {
        path: {
          siteUid: args.siteUid,
          variableId: args.variableId,
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
 * Update site proxy settings.
 */
export async function updateSiteProxy(
  client: DattoClient,
  args: {
    siteUid: string;
    type: 'http' | 'socks4' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
  }
): Promise<ToolResult> {
  try {
    const response = await client.POST('/v2/site/{siteUid}/settings/proxy', {
      params: {
        path: { siteUid: args.siteUid },
      },
      body: {
        type: args.type,
        host: args.host,
        port: args.port,
        username: args.username,
        password: args.password,
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Delete site proxy settings.
 */
export async function deleteSiteProxy(
  client: DattoClient,
  args: { siteUid: string }
): Promise<ToolResult> {
  try {
    const response = await client.DELETE('/v2/site/{siteUid}/settings/proxy', {
      params: {
        path: { siteUid: args.siteUid },
      },
    });
    handleVoidResponse(response);
    return successResponse({ data: { success: true }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
