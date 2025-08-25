# Email Setup Guide for Password Reset

## Environment Variables Required

Add the following environment variables to your `.env` file:

```env
# SMTP Configuration for Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=nabeelhussain8873@gmail.com
SMTP_PASS=cakrmmmjdodmhpka
SMTP_FROM=nabeelhussain8873@gmail.com

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:5173
```

## Gmail App Password Setup

1. Go to your Google Account settings
2. Enable 2-Factor Authentication if not already enabled
3. Go to Security → App passwords
4. Generate a new app password for "Mail"
5. Use this app password as `SMTP_PASS` (not your regular Gmail password)

## How the Password Reset Flow Works

### 1. User Requests Password Reset
- User enters email in frontend
- Frontend calls `POST /auth/forgot-password` with email
- Backend generates secure token and sends email
- User receives email with reset link

### 2. User Clicks Reset Link
- Frontend receives token from URL parameter
- Frontend can optionally verify token with `POST /auth/verify-reset-token`
- Frontend shows password reset form

### 3. User Submits New Password
- Frontend calls `POST /auth/reset-password` with token and new password
- Backend validates token, updates password, and sends success email
- User can now login with new password

## API Endpoints

### POST /auth/forgot-password
```json
{
  "email": "user@example.com"
}
```

### POST /auth/verify-reset-token
```json
{
  "token": "reset_token_from_email"
}
```

### POST /auth/reset-password
```json
{
  "token": "reset_token_from_email",
  "password": "new_password",
  "confirmPassword": "new_password"
}
```

## Security Features

- Rate limiting: 3 forgot password requests per 5 minutes
- Token expiration: 1 hour
- Secure token generation using crypto.randomBytes
- Password confirmation validation
- Email notifications for both reset request and success
- Generic response messages to prevent email enumeration

## Frontend Integration

The reset URL format is: `${FRONTEND_URL}/reset-password?token=${resetToken}`

Example frontend flow:
1. User enters email → call forgot-password endpoint
2. User clicks email link → extract token from URL
3. Verify token → call verify-reset-token endpoint
4. User enters new password → call reset-password endpoint
5. Redirect to login page
