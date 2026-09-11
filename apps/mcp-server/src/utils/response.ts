import { logger } from './logger.js';
import type { Platform } from 'datto-rmm-api';

// ─── Error codes ─────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'entity_not_found'
  | 'validation_error'
  | 'tool_not_loaded'
  | 'auth_error'
  | 'rate_limited'
  | 'permission_denied'
  | 'duplicate_detected'
  | 'api_error';

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface McpSuccess<T = unknown> {
  ok: true;
  data: T;
  count?: number;
  next_page?: string | number | null;
  _enhanced?: Record<string, unknown>;
}

export interface McpError {
  ok: false;
  error: ErrorCode;
  detail: string;
  code: number;
}

// ─── MCP protocol wrapper (unchanged — required by the protocol) ──────────────

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ─── Response builders ────────────────────────────────────────────────────────

export function successResponse<T>(payload: Omit<McpSuccess<T>, 'ok'>): ToolResult {
  const body: McpSuccess<T> = { ok: true, ...payload };
  const text = JSON.stringify(body, null, 2);
  logger.debug(`Tool response (${text.length} chars)`);
  return { content: [{ type: 'text', text }] };
}

export function errorResponse(payload: Omit<McpError, 'ok'>): ToolResult {
  const body: McpError = { ok: false, ...payload };
  const text = JSON.stringify(body, null, 2);
  logger.error(`Tool error: ${payload.error} — ${payload.detail}`);
  return { content: [{ type: 'text', text }], isError: true };
}

// ─── Error mapping ────────────────────────────────────────────────────────────

export function mapApiError(err: unknown): Omit<McpError, 'ok'> {
  const message = err instanceof Error ? err.message : String(err);

  const statusMatch = message.match(/HTTP (\d+)/);
  const status = statusMatch ? parseInt(statusMatch[1] ?? '500', 10) : 500;

  if (status === 401) {
    return { error: 'auth_error', detail: 'Authentication failed. Check API credentials.', code: 401 };
  }
  if (status === 403) {
    return { error: 'permission_denied', detail: message, code: 403 };
  }
  if (status === 404) {
    return { error: 'entity_not_found', detail: message, code: 404 };
  }
  if (status === 409) {
    return { error: 'duplicate_detected', detail: message, code: 409 };
  }
  if (status === 429) {
    return {
      error: 'rate_limited',
      detail: 'API rate limit reached. Narrow your query with date ranges or filters and retry.',
      code: 429,
    };
  }

  return { error: 'api_error', detail: message, code: status };
}

// ─── API response unwrapper (unchanged contract) ──────────────────────────────

let currentPlatform: Platform | undefined;

export function setPlatform(platform: Platform): void {
  currentPlatform = platform;
}

export function handleResponse<T>(response: {
  data?: unknown;
  error?: unknown;
  response: Response;
}): T {
  const url = response.response.url;
  const status = response.response.status;

  logger.info(`API ${status} ${url}`);

  if (!response.response.ok) {
    const errorInfo = response.error
      ? formatError(response.error)
      : `HTTP ${status}`;
    logger.error(`API Error: ${status} ${url} — ${errorInfo}`);
    throw new Error(errorInfo);
  }

  if (response.error) {
    const errorMsg = formatError(response.error);
    logger.error(`API Error: ${url} — ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const data = response.data as T | undefined;
  if (data === undefined || data === null) {
    logger.error(`API Error: ${url} — No data returned`);
    throw new Error('No data returned from API');
  }

  logger.debug(`API response: ${JSON.stringify(data).substring(0, 500)}...`);
  return data;
}

export function handleVoidResponse(response: { error?: unknown; response: Response }): void {
  const url = response.response.url;
  const status = response.response.status;

  logger.info(`API ${status} ${url}`);

  if (!response.response.ok) {
    const errorInfo = response.error ? formatError(response.error) : `HTTP ${status}`;
    logger.error(`API Error: ${status} ${url} — ${errorInfo}`);
    throw new Error(errorInfo);
  }

  if (response.error) {
    const errorMsg = formatError(response.error);
    logger.error(`API Error: ${url} — ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

function formatError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e['message'] === 'string') return e['message'];
    if (typeof e['title'] === 'string') return e['title'];
    return JSON.stringify(error);
  }
  return String(error);
}

// ─── _enhanced ID resolution ─────────────────────────────────────────────────

/**
 * Walk response data and extract uid→name mappings so the AI can resolve IDs
 * without extra lookup calls. Finds siteUid/siteName and deviceUid/deviceName
 * pairs (and uid/hostname on Device objects) anywhere in the response tree.
 */
export function buildEnhanced(data: unknown): Record<string, unknown> {
  const sites: Record<string, string> = {};
  const devices: Record<string, string> = {};

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const o = node as Record<string, unknown>;

    if (typeof o['siteUid'] === 'string' && typeof o['siteName'] === 'string') {
      sites[o['siteUid']] = o['siteName'];
    }
    if (typeof o['deviceUid'] === 'string' && typeof o['deviceName'] === 'string') {
      devices[o['deviceUid']] = o['deviceName'];
    }
    // Device objects use uid + hostname instead of deviceUid + deviceName
    if (typeof o['uid'] === 'string' && typeof o['hostname'] === 'string') {
      devices[o['uid']] = o['hostname'];
    }

    for (const val of Object.values(o)) {
      if (val && typeof val === 'object') walk(val);
    }
  }

  walk(data);

  const result: Record<string, unknown> = {};
  if (Object.keys(sites).length > 0) result['sites'] = sites;
  if (Object.keys(devices).length > 0) result['devices'] = devices;
  return result;
}

// ─── Pagination helper (used by tool handlers) ────────────────────────────────

export interface PageMeta {
  count: number;
  next_page: string | null;
}

export function extractPageMeta(pageData: {
  pageDetails?: { count?: number; nextPageUrl?: string | null; } | null;
}): PageMeta {
  return {
    count: pageData.pageDetails?.count ?? 0,
    next_page: pageData.pageDetails?.nextPageUrl ?? null,
  };
}
