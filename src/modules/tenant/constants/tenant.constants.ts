/**
 * Tenant module constants. Use these instead of hardcoded strings.
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

/** API response messages */
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

/** DTO validation messages */
export const TENANT_VALIDATION = {
  NAME_REQUIRED: 'Name is required',
  NAME_STRING: 'Name must be a string',
  NAME_MAX_LENGTH: 'Name cannot exceed 255 characters',
} as const;
