import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from 'src/modules/auth/interfaces';
import { AUTH_MESSAGES } from 'src/common/constants';
import { isAdminEquivalentRole } from './guard-helpers';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const userPermissions = (user?.permissions || []).map((p) => (p || '').toLowerCase());

    if (isAdminEquivalentRole(user?.role)) return true;
    const allowed = required.some((perm) => userPermissions.includes((perm || '').toLowerCase()));
    if (!allowed) throw new ForbiddenException(AUTH_MESSAGES.PERMISSION_DENIED);
    return true;
  }
}
