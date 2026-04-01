/**
 * User-facing messages and small config values for the Department module.
 */

export const DEPARTMENT_MESSAGES = {
  TENANT_CONTEXT_REQUIRED: 'Tenant context is required',

  ALREADY_EXISTS_IN_COMPANY: (name: string) => `Department '${name}' already exists in your company.`,

  NAME_UNIQUE_WITHIN_COMPANY: 'Department name must be unique within your company',

  NAME_REQUIRED: 'Department name is required.',

  NOT_FOUND: 'Department not found',

  NOT_FOUND_DOT: 'Department not found.',

  GLOBAL_CANNOT_MODIFY:
    'Global departments cannot be modified. They are provided as reference templates for your organization.',

  GLOBAL_VIEW_ONLY_REFERENCE:
    'This is a global department and cannot be modified. You can only view it as a reference.',

  DOES_NOT_BELONG_TO_ORG: 'Department does not belong to your organization',

  NAME_ALREADY_EXISTS_FOR_TENANT: (name: string) => `Department name '${name}' already exists for this tenant.`,

  GLOBAL_CANNOT_DELETE:
    'Global departments cannot be deleted. They are provided as reference templates for your organization.',

  HAS_DESIGNATIONS: (deptName: string, count: number) =>
    `Cannot delete department "${deptName}" because it contains ${count} designation(s). Please delete all designations first, or reassign employees to other designations.`,

  DELETE_BLOCKED_BY_FK:
    'Cannot delete department because it is still being referenced by other records. Please check for any remaining designations or employees.',
} as const;
