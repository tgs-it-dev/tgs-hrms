import * as jwt from 'jsonwebtoken';

export function makeBearerToken(
  role: string,
  overrides: Partial<{ sub: string; tenantId: string }> = {}
) {
  const payload = {
    sub: overrides.sub ?? `e2e-${role}-${Date.now()}`, // unique user id
    tenantId: overrides.tenantId ?? process.env.TEST_TENANT!, // ← set in .env.test
    role,
  };

  const secret = process.env.JWT_SECRET!; // defined in .env / CI

  const signed = jwt.sign(payload, secret, { expiresIn: '1h' });
  return `Bearer ${signed}`;
}
