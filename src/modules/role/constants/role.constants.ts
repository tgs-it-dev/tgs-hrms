/**
 * Role module constants. No hardcoded values in controllers, services, or DTOs.
 */

/** Roles allowed to manage roles (admin, system-admin, hr-admin) */
export const ROLE_MANAGE_ROLES = ['admin', 'system-admin', 'hr-admin'] as const;

/** Roles allowed for create/update/delete (admin, system-admin only) */
export const ROLE_MANAGE_ROLES_STRICT = ['admin', 'system-admin'] as const;

/** Permission required for role CRUD */
export const ROLE_MANAGE_PERMISSION = 'manage_roles';

/** API / Controller */
export const ROLE_API = {
  TAG: 'Roles',
  ROUTE_PREFIX: 'roles',
  ID_PARAM: 'id',
} as const;

/** Example values for Swagger / API docs */
export const ROLE_SWAGGER = {
  EXAMPLE_UUID: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  PARAM_UUID_DESCRIPTION: 'Role UUID',
  EXAMPLE_NAME: 'admin',
  EXAMPLE_NAME_MANAGER: 'manager',
  EXAMPLE_DESCRIPTION: 'Manager with department access',
  EXAMPLE_DESCRIPTION_ADMIN: 'Administrator with full access',
  NAME_FIELD_DESCRIPTION: 'Role name (unique, max 50 characters)',
  DESCRIPTION_FIELD_DESCRIPTION: 'Role description',
} as const;

/** API operation summaries (Swagger) */
export const ROLE_OPERATIONS = {
  GET_ALL: 'Get all roles (Admin only)',
  GET_BY_ID: 'Get role by ID (Admin only)',
  CREATE: 'Create a new role (Admin only)',
  UPDATE: 'Update role by ID (Admin only)',
  DELETE: 'Delete role by ID (Admin only)',
} as const;

/** API response descriptions (Swagger) */
export const ROLE_API_RESPONSES = {
  UNAUTHORIZED: 'Unauthorized - Invalid or missing JWT token',
  FORBIDDEN: 'Forbidden - Insufficient permissions',
  BAD_REQUEST_INVALID_DATA: 'Bad Request - Invalid role data',
  NOT_FOUND: 'Role not found',
} as const;

/** API response messages */
export const ROLE_MESSAGES = {
  LIST_SUCCESS: 'List of roles retrieved successfully.',
  GET_SUCCESS: 'Role retrieved successfully.',
  CREATE_SUCCESS: 'Role created successfully.',
  UPDATE_SUCCESS: 'Role updated successfully.',
  DELETE_SUCCESS: 'Role deleted successfully.',
  FETCH_FAILED: 'Failed to fetch roles',
  FETCH_ONE_FAILED: 'Failed to fetch role',
  CREATE_FAILED: 'Failed to create role',
  UPDATE_FAILED: 'Failed to update role',
  DELETE_FAILED: 'Failed to delete role',
} as const;

/** Service/domain error messages */
export const ROLE_ERRORS = {
  NOT_FOUND: (id: string) => `Role with ID ${id} not found`,
} as const;

/** Name field constraint (must match entity) */
export const ROLE_NAME_MAX_LENGTH = 50;

/** DTO validation messages */
export const ROLE_VALIDATION = {
  NAME_REQUIRED: 'Name is required',
  NAME_STRING: 'Name must be a string',
  NAME_MAX_LENGTH: `Name cannot exceed ${ROLE_NAME_MAX_LENGTH} characters`,
  DESCRIPTION_REQUIRED: 'Description is required',
  DESCRIPTION_STRING: 'Description must be a string',
} as const;
