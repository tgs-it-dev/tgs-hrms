/**
 * User-facing messages and config for the Designation module.
 */

export const DESIGNATION_LIST_PAGE_SIZE = 25;

export const DESIGNATION_MESSAGES = {
  DEPARTMENT_NOT_FOUND: 'Department not found. Please select a valid department.',

  DEPARTMENT_NOT_IN_ORG: 'Department does not belong to your organization',

  TITLE_EXISTS_IN_DEPARTMENT: 'Designation with this title already exists in this department',

  TITLE_UNIQUE_IN_DEPARTMENT: 'Title must be unique within the department',

  MISSING_REQUIRED_FIELDS: 'Missing required fields',

  NOT_FOUND_DOT: 'Designation not found.',

  GLOBAL_READ_ONLY_MODIFY: 'Global designations are read-only reference templates and cannot be modified.',

  GLOBAL_READ_ONLY_DELETE: 'Global designations are read-only reference templates and cannot be deleted.',

  TITLE_ALREADY_IN_DEPARTMENT: (title: string) => `Title '${title}' already exists in this department.`,

  HAS_EMPLOYEES: (title: string, count: number) =>
    `Cannot delete designation "${title}" because it has ${count} employee(s) assigned. Please reassign employees to other designations first.`,

  DELETE_BLOCKED_BY_FK:
    'Cannot delete designation because it is still being referenced by employees. Please reassign employees to other designations first.',
} as const;
