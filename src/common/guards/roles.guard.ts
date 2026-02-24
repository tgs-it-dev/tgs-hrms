import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from 'src/modules/auth/interfaces';
import { isAdminEquivalentRole, normalizeRole } from './guard-helpers';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!requiredRoles?.length) return true;

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = normalizeRole(request.user?.role);
    const normalizedRequired = requiredRoles.map((r) => normalizeRole(r));

    if (normalizedRequired.includes(userRole)) return true;
    if (isAdminEquivalentRole(userRole) && normalizedRequired.some(isAdminEquivalentRole)) return true;
    return false;
  }
}
