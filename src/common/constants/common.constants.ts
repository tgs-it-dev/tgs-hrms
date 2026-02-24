export const VALIDATION_ERROR = {
  ENTITY_NOT_FOUND: 'Entity not found',
};

/** Keys in request body that are redacted when logging. */
export const SENSITIVE_BODY_KEYS = ['password', 'token'] as const;

/** Placeholder shown in logs for redacted sensitive values. */
export const REDACTED_PLACEHOLDER = '***REDACTED***';

/** Default sort field for paginated queries when none specified. */
export const DEFAULT_SORT_FIELD = 'created_at';
