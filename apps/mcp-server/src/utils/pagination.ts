/**
 * Standard pagination parameters used across Datto RMM API.
 */
export interface PaginationParams {
  page?: number;
  max?: number;
}

/**
 * Default page size for list operations.
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Maximum page size allowed by the API.
 */
export const MAX_PAGE_SIZE = 250;

/**
 * Normalize pagination parameters with defaults.
 * Note: User-facing page numbers are 1-based, but API uses 0-based indexing.
 * This function converts from user format to API format.
 */
export function normalizePagination(params?: PaginationParams): Required<PaginationParams> {
  const userPage = params?.page ?? 1;  // User provides 1-based page numbers
  return {
    page: Math.max(0, userPage - 1),  // Convert to 0-based for API
    max: Math.min(params?.max ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

/**
 * Extract pagination info from a paginated response.
 */
export interface PageInfo {
  page: number;
  totalPages: number;
  count: number;
  hasMore: boolean;
}

/**
 * Parse pagination info from API response.
 * Note: API returns 0-based page numbers, but we display 1-based for better UX.
 */
export function parsePageInfo(response: {
  pageDetails?: {
    page?: number;
    totalPages?: number;
    count?: number;
  } | null;
}): PageInfo {
  const details = response.pageDetails;
  const apiPage = details?.page ?? 0;  // API uses 0-based
  const totalPages = details?.totalPages ?? 1;
  const count = details?.count ?? 0;

  return {
    page: apiPage + 1,  // Convert to 1-based for display
    totalPages,
    count,
    hasMore: apiPage < totalPages - 1,  // Check against 0-based index
  };
}
