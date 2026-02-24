/**
 * Route paths used for middleware exclusions and guards.
 * Single source of truth for public/unauthenticated routes.
 */

export const AUTH_ROUTES = {
  LOGIN: 'auth/login',
  REGISTER: 'auth/register',
  FORGOT_PASSWORD: 'auth/forgot-password',
  RESET_PASSWORD: 'auth/reset-password',
  VERIFY_EMAIL: 'auth/verify-email',
  RESEND_VERIFICATION: 'auth/resend-verification',
  REFRESH: 'auth/refresh',
  LOGOUT: 'auth/logout',
} as const;

export const PUBLIC_ROUTES = {
  PROFILE_PICTURE_GET: 'users/:id/profile-picture',
  PROFILE_PICTURES: 'profile-pictures/(.*)',
  CNIC_PICTURES: 'cnic-pictures/(.*)',
  CNIC_BACK_PICTURES: 'cnic-back-pictures/(.*)',
  COMPANY_LOGOS: 'company-logos/(.*)',
  SIGNUP_PERSONAL: 'signup/personal-details',
  SIGNUP_COMPANY: 'signup/company-details',
  SIGNUP_UPLOAD_LOGO: 'signup/upload-logo',
  SIGNUP_PAYMENT: 'signup/payment',
  SIGNUP_PAYMENT_CONFIRM: 'signup/payment/confirm',
  SIGNUP_COMPLETE: 'signup/complete',
  SIGNUP_GOOGLE: 'signup/google-init',
  SUBSCRIPTION_PLANS: 'subscription-plans',
  SUBSCRIPTION_PLANS_PRICES: 'subscription-plans/prices',
  HEALTH: 'health',
  DOCS: 'docs',
  API_DOCS: 'api-docs',
} as const;
