/**
 * Tenant module constants. No hardcoded values in controllers, services, or DTOs.
 */

/** Tenant status values (must match entity) */
export const TenantStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;

export type TenantStatusType = (typeof TenantStatus)[keyof typeof TenantStatus];

/** Role required for tenant management (admin only) */
export const TENANT_ADMIN_ROLE = 'system-admin';

/** Permission required for tenant CRUD */
export const TENANT_MANAGE_PERMISSION = 'manage_tenants';

/** Pagination defaults and limits */
export const TENANT_PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
} as const;

/** Radix for parsing numeric query params */
export const PARSE_INT_RADIX = 10;

/** API / Controller */
export const TENANT_API = {
  TAG: 'Tenants',
  ROUTE_PREFIX: 'tenants',
  ID_PARAM: 'id',
  RESTORE_PATH: 'restore',
} as const;

/** Example values for Swagger / API docs */
export const TENANT_SWAGGER = {
  EXAMPLE_UUID: '550e8400-e29b-41d4-a716-446655440000',
  EXAMPLE_NAME: 'Default Company',
  EXAMPLE_NAME_NEW: 'New Company',
  EXAMPLE_CREATED_AT: '2024-01-01T00:00:00.000Z',
  PARAM_UUID_DESCRIPTION: 'Tenant UUID',
  NAME_FIELD_DESCRIPTION: 'Tenant name',
} as const;

/** API operation summaries (Swagger) */
export const TENANT_OPERATIONS = {
  GET_ALL: 'Get all tenants (Admin only) - Paginated',
  GET_BY_ID: 'Get tenant by ID (Admin only)',
  CREATE: 'Create a new tenant (Admin only)',
  UPDATE: 'Update tenant by ID (Admin only)',
  DELETE: 'Delete tenant by ID (Admin only)',
  RESTORE: 'Restore a deleted tenant (Admin only)',
} as const;

/** API response descriptions (Swagger) */
export const TENANT_API_RESPONSES = {
  UNAUTHORIZED: 'Unauthorized - Invalid or missing JWT token',
  FORBIDDEN: 'Forbidden - Insufficient permissions',
  BAD_REQUEST_INVALID_DATA: 'Bad Request - Invalid tenant data',
  BAD_REQUEST_ALREADY_DELETED: 'Bad Request - Tenant already deleted',
  BAD_REQUEST_NOT_DELETED: 'Bad Request - Tenant is not deleted',
} as const;

/** API response messages (success / generic errors) */
export const TENANT_MESSAGES = {
  LIST_SUCCESS: 'List of tenants retrieved successfully.',
  GET_SUCCESS: 'Tenant retrieved successfully.',
  CREATE_SUCCESS: 'Tenant created successfully.',
  UPDATE_SUCCESS: 'Tenant updated successfully.',
  DELETE_SUCCESS: 'Tenant deleted successfully.',
  RESTORE_SUCCESS: 'Tenant restored successfully.',
  FETCH_FAILED: 'Failed to fetch tenants',
  FETCH_ONE_FAILED: 'Failed to fetch tenant',
  CREATE_FAILED: 'Failed to create tenant',
  UPDATE_FAILED: 'Failed to update tenant',
  DELETE_FAILED: 'Failed to delete tenant',
  RESTORE_FAILED: 'Failed to restore tenant',
} as const;

/** Service/domain error messages */
export const TENANT_ERRORS = {
  NOT_FOUND: 'Tenant not found',
  ALREADY_DELETED: 'Tenant is already deleted',
  NOT_DELETED: 'Tenant is not deleted',
  DELETED: 'Tenant has been deleted',
  CANNOT_UPDATE_DELETED: 'Cannot update a deleted tenant. Please restore it first.',
} as const;

/** Name field constraint (must match DB/entity) */
export const TENANT_NAME_MAX_LENGTH = 255;

/** DTO validation messages */
export const TENANT_VALIDATION = {
  NAME_REQUIRED: 'Name is required',
  NAME_STRING: 'Name must be a string',
  NAME_MAX_LENGTH: `Name cannot exceed ${TENANT_NAME_MAX_LENGTH} characters`,
} as const;
