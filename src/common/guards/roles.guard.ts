import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayloadDto } from 'src/modules/auth/dto/jwt-payload.dto';

/**
 * Global roles guard (registered as APP_GUARD in AppModule).
 *
 * Behaviour:
 *  - Routes decorated with @Public() are skipped entirely.
 *  - Routes with no @Roles() metadata pass through (open to any authenticated user).
 *  - Routes with @Roles('owner', 'hr_admin', …) require the caller's role to match
 *    at least one of the listed values (case-insensitive).
 *
 * Special cases:
 *  - @Roles('system-admin') requires an exact match — admin-equivalence does NOT apply.
 *  - admin / system-admin / network-admin / hr-admin are treated as equivalent when
 *    any of them appears in the required list alongside ordinary admin roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Skip for public routes (e.g. login, signup, public invite page)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // No @Roles() decoration → route is accessible by any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request: { user: JwtPayloadDto } = ctx
      .switchToHttp()
      .getRequest<{ user: JwtPayloadDto }>();
    const user = request.user;

    const userRole = (user?.role ?? '').toLowerCase();
    const normalizedRequired = requiredRoles.map((r) =>
      (r ?? '').toLowerCase(),
    );

    // system-admin-only routes: exact match, no admin-equivalence
    if (
      normalizedRequired.length === 1 &&
      normalizedRequired[0] === 'system-admin'
    ) {
      return userRole === 'system-admin';
    }

    const isAdminEquivalent = (role: string): boolean =>
      role === 'admin' ||
      role === 'system-admin' ||
      role === 'network-admin' ||
      role === 'hr-admin';

    // Direct role match
    if (normalizedRequired.includes(userRole)) return true;

    // Admin-equivalence: any required role is admin-like AND caller is admin-like
    if (
      normalizedRequired.some(isAdminEquivalent) &&
      isAdminEquivalent(userRole)
    ) {
      return true;
    }

    return false;
  }
}
