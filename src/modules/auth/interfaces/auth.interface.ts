import { Request } from 'express';
import { User } from '../../../entities/user.entity';
import { Employee } from '../../../entities/employee.entity';

export interface JwtPayload {
  id: string;
  sub: string;
  email: string;
  role: string;
  tenant_id: string | null;
  permissions: string[];
  first_name: string;
  last_name: string;
}

export interface AuthPayload {
  email: string;
  sub: string;
  role: string;
  tenant_id: string | null;
  permissions: string[];
}

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

export interface AuthResponse {
  message: string;
}

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

export interface RegisterResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  message: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}

export interface CompanyInfo {
  id: string;
  name: string;
  is_paid: boolean;
  domain?: string;
  company_name?: string;
  logo_url?: string;
  tenant_id?: string;
  plan_id?: string | null;
  stripe_session_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_payment_intent_id?: string | null;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
