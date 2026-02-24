/**
 * Email service log and config messages.
 */

export const EMAIL_MESSAGE = {
  SENDGRID_CONFIGURED: 'SendGrid API key configured successfully',
  SENDGRID_KEY_NOT_FOUND: 'SENDGRID_API_KEY not found. Email functionality will be disabled.',
  SENDGRID_FROM_NOT_CONFIGURED: 'SENDGRID_FROM not configured. Skipping email send.',
  SENT_SUCCESS: 'sent successfully',
  SEND_FAILED: 'Failed to send',
  TEMPLATE_NOT_FOUND: 'Email template not found',
  TEMPLATE_USING_EMPTY: 'using empty string',
} as const;

export const EMAIL_TEMPLATE = {
  DIR_SRC: 'src',
  DIR_TEMPLATES: 'templates',
  DIR_DIST: 'dist',
  EXTENSION: '.hbs',
  ENCODING: 'utf-8',
} as const;
