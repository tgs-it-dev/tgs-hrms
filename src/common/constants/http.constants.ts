/**
 * HTTP and exception-filter related constants.
 */

export const HTTP_ERROR = {
  INTERNAL_SERVER_ERROR: 'Internal server error',
  CORS_NOT_ALLOWED: 'Not allowed by CORS',
  CORRELATION_ID_UNKNOWN: 'unknown',
} as const;

export const HTTP_HEADER = {
  CORRELATION_ID: 'x-correlation-id',
  CORRELATION_ID_RESPONSE: 'X-Correlation-ID',
} as const;
