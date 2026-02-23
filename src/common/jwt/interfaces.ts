/**
 * JWT payload shape used across the project (access & refresh tokens).
 * Kept in common so JWT helper and any module can use it without depending on auth.
 */
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
