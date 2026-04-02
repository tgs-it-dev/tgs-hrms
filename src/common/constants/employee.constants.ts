/**
 * Employee module: user-facing messages, role names, and operational constants.
 * Keep strings here instead of scattering literals across services/controllers.
 */

/** Canonical role names stored in `roles.name` (see migrations / seeders). */
export const EMPLOYEE_ROLE_NAMES = {
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
} as const;

export const EMPLOYEE_MESSAGES = {
  INVALID_DESIGNATION_ID: 'Invalid designation ID',
  DESIGNATION_NOT_IN_TENANT: 'Designation does not belong to your organization',
  INVALID_TEAM_ID: 'Invalid team ID',
  TEAM_NOT_IN_TENANT: 'Team does not belong to this tenant',
  FIELD_MUST_BE_UUID: (field: string) => `${field} must be a valid UUID`,
  EMAIL_ALREADY_IN_TENANT: 'User with this email already exists in the tenant.',
  MANAGER_ROLE_NOT_FOUND:
    'Manager role not found. Please create a manager role first.',
  EMPLOYEE_ROLE_NOT_FOUND: 'Employee role not found.',
  ROLE_NOT_FOUND_BY_NAME: (name: string) => `Role with name '${name}' not found.`,
  SPECIFIED_ROLE_NOT_FOUND: 'Specified role not found.',
  PROMOTE_FAILED: 'Failed to promote employee to manager',
  DEMOTE_FAILED: 'Failed to demote manager to employee',
  MANAGER_ALREADY_EXISTS: 'Manager already exists.',
  EMPLOYEE_ALREADY_EXISTS: 'Employee already exists.',
  EMPLOYEE_NOT_FOUND: 'Employee not found',
  EMPLOYEE_NOT_FOUND_FOR_TENANT: 'Employee not found for this tenant',
  USER_NOT_FOUND_AFTER_CREATE: 'User not found after employee creation',
  PAYMENT_METHOD_REQUIRED:
    'Payment method required. Please complete payment to create employee.',
  PAYMENT_CHECKOUT_FAILED: (detail: string) =>
    `Payment method required but failed to create checkout session: ${detail}`,
  PAYMENT_FAILED_PREFIX: (detail: string) =>
    `Payment processing failed: ${detail}. Employee creation cannot be completed without successful payment.`,
  INVITE_ONLY_WHEN_EXPIRED: 'Invite can only be resent if status is Invite Expired',
  INVITE_RESENT: 'Invite resent successfully',
  DOCUMENT_NOT_FOUND: 'Document not found for this employee',
  EMPLOYEE_NOT_FOUND_AFTER_UPDATE: 'Employee not found after update',
  NO_PROFILE_PICTURE: 'No profile picture available',
  INVALID_IMAGE_PATH: 'Invalid image path',
  PROFILE_FILE_NOT_FOUND: 'Profile picture file not found',
  NO_CNIC_PICTURE: 'No CNIC picture available',
  INVALID_CNIC_PATH: 'Invalid CNIC image path',
  CNIC_FILE_NOT_FOUND: 'CNIC picture file not found',
  NO_CNIC_BACK: 'No CNIC back picture available',
  INVALID_CNIC_BACK_PATH: 'Invalid CNIC back image path',
  CNIC_BACK_FILE_NOT_FOUND: 'CNIC back picture file not found',
  UPLOAD_PROFILE_FAILED: 'Failed to upload profile picture',
  UPLOAD_CNIC_FAILED: 'Failed to upload CNIC picture',
  UPLOAD_CNIC_BACK_FAILED: 'Failed to upload CNIC back picture',
} as const;

/** Substrings matched on billing/payment errors to trigger checkout flow. */
export const EMPLOYEE_PAYMENT_ERROR_MARKERS = [
  'PAYMENT_METHOD_REQUIRED',
  'Payment method',
  'payment_intent_authentication_required',
] as const;

export const EMPLOYEE_SALARY_NOTES = {
  ON_STANDARD_CREATE: 'Auto-created default salary structure on employee creation',
  ON_MANAGER_CREATE: 'Auto-created default salary structure on manager creation',
  ON_CREATE_AFTER_PAYMENT:
    'Auto-created default salary structure on employee creation after payment',
} as const;

export const EMPLOYEE_LIST_PAGE_SIZE = 25;

/** Hours until password-reset token expires for new invites. */
export const EMPLOYEE_RESET_TOKEN_EXPIRY_HOURS = 24;
