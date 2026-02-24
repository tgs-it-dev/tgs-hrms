export const VALIDATION_ERROR = {
  ENTITY_NOT_FOUND: 'Entity not found',
  TENANT_ID_REQUIRED: 'Tenant context is required. Ensure the route is protected by JWT and tenant guards.',
};

/** Keys in request body that are redacted when logging. */
export const SENSITIVE_BODY_KEYS = ['password', 'token'] as const;

/** Placeholder shown in logs for redacted sensitive values. */
export const REDACTED_PLACEHOLDER = '***REDACTED***';

/** Default sort field for paginated queries when none specified. */
export const DEFAULT_SORT_FIELD = 'created_at';
