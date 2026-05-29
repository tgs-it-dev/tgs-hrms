import { ExecutionContext } from '@nestjs/common';
import { GLOBAL_SYSTEM_TENANT_ID } from '../constants/enums';
import { extractTenantId } from './company.deorator';

function mockContext(user: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('@TenantId() decorator', () => {
  it('returns tenant_id for a regular user', () => {
    const ctx = mockContext({ role: 'employee', tenant_id: 'abc-123' });
    expect(extractTenantId(undefined, ctx)).toBe('abc-123');
  });

  it('returns GLOBAL_SYSTEM_TENANT_ID for system-admin regardless of tenant_id', () => {
    const ctx = mockContext({
      role: 'system-admin',
      tenant_id: 'should-be-ignored',
    });
    expect(extractTenantId(undefined, ctx)).toBe(GLOBAL_SYSTEM_TENANT_ID);
  });

  it('returns undefined when user has no tenant_id', () => {
    const ctx = mockContext({ role: 'employee' });
    expect(extractTenantId(undefined, ctx)).toBeUndefined();
  });

  it('returns undefined when request has no user', () => {
    const ctx = mockContext({} as Record<string, unknown>);
    expect(extractTenantId(undefined, ctx)).toBeUndefined();
  });
});
