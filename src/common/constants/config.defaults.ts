/**
 * Default values for app/config and env validation.
 * Use these instead of hardcoding in app.config.ts or env.validation.ts.
 */

// Application
export const DEFAULT_NODE_ENV = 'development';
export const DEFAULT_PORT = 3001;
export const DEFAULT_HOST = '0.0.0.0';

// Database
export const DEFAULT_DB_PORT = 5432;

// JWT
export const DEFAULT_JWT_SECRET = 'default_secret';
export const DEFAULT_JWT_EXPIRES_IN = '60m';
export const DEFAULT_JWT_REFRESH_EXPIRES_IN = '7d';

// Email
export const DEFAULT_SENDGRID_FROM = 'noreply@example.com';

// File Upload (5MB)
export const DEFAULT_MAX_FILE_SIZE = 5242880;
export const DEFAULT_ALLOWED_IMAGE_TYPES = 'jpg,jpeg,png,gif,webp';
export const DEFAULT_ALLOWED_DOCUMENT_TYPES = 'pdf,doc,docx,xls,xlsx,txt';

// Security
export const DEFAULT_CORS_ORIGINS = 'http://localhost:5173';
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 900000; // 15 minutes
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

// Logging
export const DEFAULT_LOG_LEVEL = 'info';
export const DEFAULT_LOG_DIRECTORY = 'logs';
