export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenant_id: string;
  permissions?: string[];
  first_name?: string;
  last_name?: string;
}
