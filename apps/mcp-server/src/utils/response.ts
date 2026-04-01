import { formatError } from './formatting.js';
import { logger } from './logger.js';

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
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/**
 * Create a success result.
 */
export function successResult(text: string): ToolResult {
  return {
    content: [{ type: 'text', text }],
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
