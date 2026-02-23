/**
 * Auth-related numeric/time constants.
 */

/** bcrypt salt rounds for hashing passwords and tokens. */
export const BCRYPT_SALT_ROUNDS = 10;

/** Password reset token validity: 1 hour in milliseconds. */
export const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/** Bytes used for secure random reset token (randomBytes). */
export const RESET_TOKEN_BYTES = 32;

/** Minimum password length for validation. */
export const MIN_PASSWORD_LENGTH = 6;

/** Email subject for password reset request. */
export const EMAIL_SUBJECT_PASSWORD_RESET = 'Password Reset Request';

/** Email subject for password reset success. */
export const EMAIL_SUBJECT_PASSWORD_RESET_SUCCESS = 'Password Reset Successful';

/** Auth throttle: register/forgot-password – requests per window. */
export const AUTH_THROTTLE_REGISTER_LIMIT = 3;
/** Auth throttle: register/forgot-password – window in ms (5 min). */
export const AUTH_THROTTLE_REGISTER_TTL_MS = 300_000;

/** Auth throttle: login – requests per window. */
export const AUTH_THROTTLE_LOGIN_LIMIT = 5;
/** Auth throttle: login – window in ms (1 min). */
export const AUTH_THROTTLE_LOGIN_TTL_MS = 60_000;

/** Auth throttle: reset-password – requests per window. */
export const AUTH_THROTTLE_RESET_LIMIT = 5;
/** Auth throttle: reset-password – window in ms (5 min). */
export const AUTH_THROTTLE_RESET_TTL_MS = 300_000;
