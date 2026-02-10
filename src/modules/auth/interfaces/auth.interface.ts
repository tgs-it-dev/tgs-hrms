import { Request } from 'express';
import { User } from '../../../entities/user.entity';
import { Employee } from '../../../entities/employee.entity';
import type { JwtPayload } from 'src/common/jwt';

/** Re-export so existing auth consumers keep working; source of truth is common/jwt */
export type { JwtPayload };

/** Minimal auth payload (e.g. for token signing) */
export interface AuthPayload {
  email: string;
  sub: string;
  role: string;
  tenant_id: string | null;
  permissions: string[];
}

/** Result of token validation (validateToken) */
export interface ValidatedUser {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    tenant_id: string | null;
    permissions: string[];
  };
  message?: string;
}

/** Generic message response */
export interface AuthResponse {
  message: string;
}

/** Login success response */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  permissions: string[];
  employee: Employee | null;
  company: CompanyInfo | null;
  requiresPayment: boolean;
  session_id: string | null;
}

/** Registration success response */
export interface RegisterResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  message: string;
}

/** Access token (and optional refresh) pair */
export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}

/** Company details for auth context (billing, domain, etc.) */
export interface CompanyInfo {
  id: string;
  company_name: string;
  domain: string;
  logo_url: string | null;
  tenant_id: string | null;
  is_paid: boolean;
  plan_id: string | null;
  stripe_session_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
}

/** Forgot password success response */
export interface ForgotPasswordResponse {
  message: string;
}

/** Verify reset token response */
export interface VerifyResetTokenResponse {
  valid: boolean;
  message: string;
}

/** Reset password / logout / delete success response */
export interface MessageResponse {
  message: string;
}

/** Express Request with authenticated user (set by JwtAuthGuard) */
export interface RequestWithUser extends Request {
  user: JwtPayload;
}
