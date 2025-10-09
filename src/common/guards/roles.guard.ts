import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    const userRole = (user?.role || '').toLowerCase();
    const normalizedRequired = (requiredRoles || []).map((r) => (r || '').toLowerCase());

    
    const isAdminEquivalent = (role: string) => role === 'admin' || role === 'system-admin' || role === 'network-admin';

    if (normalizedRequired.includes(userRole)) return true;

    if (
      normalizedRequired.some(isAdminEquivalent) &&
      isAdminEquivalent(userRole)
    ) {
      return true;
    }

    return false;
  }
}
