/**
 * Auth-related numeric/time constants.
 */

/** bcrypt salt rounds for hashing passwords and tokens. */
export const BCRYPT_SALT_ROUNDS = 10;

/** Password reset token validity: 1 hour in milliseconds. */
export const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
