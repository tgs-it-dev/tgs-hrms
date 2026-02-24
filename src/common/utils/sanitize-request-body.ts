/**
 * Sanitizes request body for logging by redacting sensitive keys.
 */

import { REDACTED_PLACEHOLDER, SENSITIVE_BODY_KEYS } from '../constants';

export function sanitizeRequestBody(body: object): Record<string, unknown> {
  if (!body || typeof body !== 'object') return body as Record<string, unknown>;

  const clone: Record<string, unknown> = { ...body };
  const sensitiveSet = new Set(SENSITIVE_BODY_KEYS.map((k) => k.toLowerCase()));

  for (const key of Object.keys(clone)) {
    if (sensitiveSet.has(key.toLowerCase())) {
      clone[key] = REDACTED_PLACEHOLDER;
    }
  }

  return clone;
}
