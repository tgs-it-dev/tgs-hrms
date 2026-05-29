import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(
  role: string,
  rolesMetadata?: string[],
  isPublic = false,
): ExecutionContext {
  const mockReflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === ROLES_KEY) return rolesMetadata;
      return undefined;
    }),
  } as unknown as Reflector;

  const guard = new RolesGuard(mockReflector);

  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { guard, ctx } as unknown as ExecutionContext;
}

// Helper that returns guard + ctx together
function build(
  role: string,
  rolesMetadata?: string[],
  isPublic = false,
): { guard: RolesGuard; ctx: ExecutionContext } {
  const mockReflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === ROLES_KEY) return rolesMetadata;
      return undefined;
    }),
  } as unknown as Reflector;

  const guard = new RolesGuard(mockReflector);

  const ctx = {
    switchToHttp: () => ({
      getRequest: <T>() => ({ user: { role } }) as T,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { guard, ctx };
}

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('RolesGuard', () => {
  // ── @Public() bypass ────────────────────────────────────────────────────────
  describe('@Public() routes', () => {
    it('returns true regardless of user role when isPublic = true', () => {
      const { guard, ctx } = build('employee', ['admin'], true);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns true even with no user on request when isPublic = true', () => {
      const mockReflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === IS_PUBLIC_KEY) return true;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new RolesGuard(mockReflector);
      const ctx = {
        switchToHttp: () => ({ getRequest: <T>() => ({}) as T }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  // ── No @Roles() metadata ────────────────────────────────────────────────────
  describe('no @Roles() metadata', () => {
    it('returns true when no roles required (open to any authenticated user)', () => {
      const { guard, ctx } = build('employee', undefined);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns true when roles metadata is an empty array', () => {
      const { guard, ctx } = build('employee', []);
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  // ── Direct role match ───────────────────────────────────────────────────────
  describe('direct role match', () => {
    it('allows access when user role is in required list', () => {
      const { guard, ctx } = build('hr_admin', ['owner', 'hr_admin']);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('is case-insensitive — HR_ADMIN matches hr_admin requirement', () => {
      const { guard, ctx } = build('HR_ADMIN', ['hr_admin']);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns false when user role is not in required list', () => {
      const { guard, ctx } = build('employee', ['owner', 'hr_admin']);
      expect(guard.canActivate(ctx)).toBe(false);
    });
  });

  // ── Admin-equivalence ───────────────────────────────────────────────────────
  describe('admin-equivalence', () => {
    it('allows hr-admin when route requires admin', () => {
      const { guard, ctx } = build('hr-admin', ['admin']);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows system-admin when route requires admin', () => {
      const { guard, ctx } = build('system-admin', ['admin']);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows network-admin when route requires admin', () => {
      const { guard, ctx } = build('network-admin', ['admin']);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects employee role when only admin-equivalent roles are required', () => {
      const { guard, ctx } = build('employee', ['admin']);
      expect(guard.canActivate(ctx)).toBe(false);
    });
  });

  // ── system-admin-only routes ────────────────────────────────────────────────
  describe('@Roles("system-admin") exact-match enforcement', () => {
    it('allows system-admin user', () => {
      const { guard, ctx } = build('system-admin', ['system-admin']);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects admin user — no equivalence on system-admin-only routes', () => {
      const { guard, ctx } = build('admin', ['system-admin']);
      expect(guard.canActivate(ctx)).toBe(false);
    });

    it('rejects hr-admin user on system-admin-only route', () => {
      const { guard, ctx } = build('hr-admin', ['system-admin']);
      expect(guard.canActivate(ctx)).toBe(false);
    });

    it('rejects employee on system-admin-only route', () => {
      const { guard, ctx } = build('employee', ['system-admin']);
      expect(guard.canActivate(ctx)).toBe(false);
    });
  });
});

// Suppress unused variable warning for makeContext (used implicitly via closure in describe scope)
void makeContext;
