/**
 * Search module constants.
 * Use these instead of hardcoding in search controller, service, or DTO.
 */

/** Default number of results per module when limit not provided. */
export const DEFAULT_SEARCH_LIMIT = 10;

/** Minimum length for search query when provided. */
export const MIN_SEARCH_QUERY_LENGTH = 2;

/** Result keys for global search (order matches response shape). */
export const SEARCH_RESULT_KEYS = [
  'employees',
  'leaves',
  'assets',
  'assetRequests',
  'teams',
  'attendance',
  'benefits',
  'payroll',
] as const;

export type SearchResultKey = (typeof SEARCH_RESULT_KEYS)[number];

/** User-facing messages for search validation/errors. */
export const SEARCH_MESSAGES = {
  QUERY_MIN_LENGTH: `Search query must be at least ${MIN_SEARCH_QUERY_LENGTH} characters long`,
  TENANT_ID_ADMIN_ONLY: 'Only system-admin and network-admin can specify tenantId parameter',
} as const;
