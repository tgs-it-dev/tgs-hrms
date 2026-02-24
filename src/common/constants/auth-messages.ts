/**
 * Auth-related user-facing and error messages.
 * Use these constants instead of hardcoded strings in the auth module.
 */

export const AUTH_MESSAGES = {
  // Registration
  USER_EMAIL_EXISTS: 'User with this email already exists in this organization',
  ONLY_ONE_SYSTEM_ADMIN: 'Only one system admin is allowed in the entire HRMS. A system admin already exists.',
  USER_REGISTERED: 'User registered successfully',

  // Login / validation
  NO_TOKEN_PROVIDED: 'No token provided',
  INVALID_TOKEN: 'Invalid token',
  USER_NOT_FOUND_OR_DELETED: 'User not found or has been deleted',
  USER_ROLE_NOT_FOUND: 'User role not found',
  ORG_ACCOUNT_DELETED: 'Your organization account has been deleted. Please contact support.',
  TOKEN_VALIDATION_FAILED: 'Token validation failed',
  EMAIL_NOT_FOUND: 'Email not found',
  INCORRECT_PASSWORD: 'Incorrect password',

  // Forgot / reset password
  INVALID_EMAIL_ADDRESS: 'Invalid email address',
  CHECK_EMAIL_RESET_LINK: 'Check your email for the password reset link.',
  TOKEN_REQUIRED: 'Token is required',
  TOKEN_VALID: 'Token is valid',
  INVALID_OR_EXPIRED_RESET_TOKEN: 'Invalid or expired reset token',
  PASSWORD_RESET_SUCCESS: 'Password reset successfully',

  // Refresh / logout
  REFRESH_TOKEN_REQUIRED: 'Refresh token is required',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  SUCCESSFULLY_LOGGED_OUT: 'Successfully logged out',

  // User
  USER_NOT_FOUND: 'User not found',
  USER_DELETED: 'User deleted successfully',

  // Permissions
  PERMISSION_DENIED: 'You do not have the required permissions',

  // JWT / Interceptor
  UNAUTHORIZED: 'Unauthorized',
  ACCESS_TOKEN_EXPIRED: 'Access token expired',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_ACCESS_TOKEN: 'Invalid access token',
  INVALID_TOKEN_CODE: 'INVALID_TOKEN',
} as const;
