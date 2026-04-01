import { formatError } from './formatting.js';
import { logger } from './logger.js';
import type { Platform } from 'datto-rmm-api';

/**
 * API call metadata to include in responses.
 */
export interface ApiCallMetadata {
  /** Platform being queried */
  platform?: Platform;
  /** HTTP method and path */
  endpoint?: string;
  /** Query parameters summary */
  params?: Record<string, any>;
}

let currentPlatform: Platform | undefined;
let lastApiUrl: string | undefined;

/**
 * Set the current platform for API metadata.
 */
export function setPlatform(platform: Platform): void {
  currentPlatform = platform;
}

/**
 * Format API call metadata as a header for responses.
 */
function formatApiMetadata(url: string): string {
  if (!currentPlatform) {
    return '';
  }

  const lines: string[] = [];
  lines.push(`_Platform: ${currentPlatform}_`);

  // Extract the API path and query from URL
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace('/api', ''); // Remove /api prefix
    const query = urlObj.search ? urlObj.search.substring(1) : '';
    
    if (query) {
      lines.push(`_API: ${path}?${query}_`);
    } else {
      lines.push(`_API: ${path}_`);
    }
  } catch {
    lines.push(`_API: ${url}_`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Result of a tool execution.
 */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Create an error result.
 */
export function errorResult(message: string): ToolResult {
  logger.error(`Tool error response to LLM: ${message}`);
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/**
 * Create a success result.
 */
export function successResult(text: string): ToolResult {
  logger.debug(`Tool response to LLM (${text.length} chars): ${text.substring(0, 200)}...`);
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Create a success result with API metadata header.
 * Automatically uses the last API call's URL if not provided.
 */
export function successResultWithMetadata(text: string, apiUrl?: string): ToolResult {
  let fullText = text;
  
  const url = apiUrl || lastApiUrl;
  if (url && currentPlatform) {
    const metadata = formatApiMetadata(url);
    fullText = metadata + text;
  }
  
  logger.info(`Tool response to LLM (${fullText.length} chars)`);
  logger.debug(`Full tool response:\n${fullText}`);
  
  return {
    content: [{ type: 'text', text: fullText }],
  };
}

/**
 * Handle API response with proper typing.
 *
 * Note: The Datto RMM OpenAPI spec doesn't define 200 responses properly,
 * so we use type assertion to extract data. In practice, the API does return
 * data on successful responses.
 */
export function handleResponse<T>(response: { data?: unknown; error?: unknown; response: Response }): T {
  // Log the API call
  const url = response.response.url;
  const status = response.response.status;
  const method = response.response.type || 'GET'; // Response.type isn't the method, need to extract differently

  // Store URL for metadata
  lastApiUrl = url;

  logger.info(`API ${response.response.status} ${response.response.url}`);

  // Check for HTTP errors
  if (!response.response.ok) {
    const errorInfo = response.error ? formatError(response.error) : `HTTP ${status}`;
    logger.error(`API Error: ${status} ${url} - ${errorInfo}`);
    throw new Error(errorInfo);
  }

  // Check for explicit error object
  if (response.error) {
    const errorMsg = formatError(response.error);
    logger.error(`API Error: ${url} - ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Cast data to expected type
  // The OpenAPI spec is missing 200 responses, but the API returns data
  const data = response.data as T | undefined;
  if (data === undefined || data === null) {
    logger.error(`API Error: ${url} - No data returned`);
    throw new Error('No data returned from API');
  }

  // Log successful response with data summary
  logger.debug(`API Response data: ${JSON.stringify(data).substring(0, 500)}...`);

  return data;
}

/**
 * Handle API response for operations that don't return data.
 */
export function handleVoidResponse(response: { error?: unknown; response: Response }): void {
  const url = response.response.url;
  const status = response.response.status;

  logger.info(`API ${status} ${url}`);

  if (!response.response.ok) {
    const errorInfo = response.error ? formatError(response.error) : `HTTP ${status}`;
    logger.error(`API Error: ${status} ${url} - ${errorInfo}`);
    throw new Error(errorInfo);
  }

  if (response.error) {
    const errorMsg = formatError(response.error);
    logger.error(`API Error: ${url} - ${errorMsg}`);
    throw new Error(errorMsg);
  }

  logger.debug(`API void response successful`);
}
