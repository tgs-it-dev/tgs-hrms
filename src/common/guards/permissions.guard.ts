import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from '../types/request.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    this.logger.log(`PermissionsGuard: Required permissions: ${JSON.stringify(required)}`);

    if (!required || required.length === 0) {
      this.logger.log(`PermissionsGuard: No permissions required, allowing access`);
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    this.logger.debug(`PermissionsGuard: User object: ${JSON.stringify(user)}`);
    this.logger.debug(`PermissionsGuard: User permissions: ${JSON.stringify(user?.permissions)}`);

    const userPermissions = (user?.permissions || []).map((p) => p.toLowerCase());
    this.logger.debug(
      `PermissionsGuard: Normalized user permissions: ${JSON.stringify(userPermissions)}`
    );

    // Check if user is admin-equivalent (admin or system-admin) -> has all permissions
    const role = (user?.role || '').toLowerCase();
    const isAdminEquivalent = role === 'system-admin' || role === 'admin' || role === 'network-admin';

    let allowed = false;
    if (isAdminEquivalent) {
      // Admin-equivalent has access to everything
      allowed = true;
      this.logger.log(`PermissionsGuard: Admin-equivalent access granted`);
    } else {
      // Regular users need to have at least one of the required permissions (OR logic)
      allowed = required.some((perm) => userPermissions.includes(perm.toLowerCase()));
      this.logger.log(
        `PermissionsGuard: Regular user permission check result - allowed: ${allowed}`
      );
    }

    if (!allowed) {
      this.logger.warn(
        `PermissionsGuard: Access denied. Required: ${JSON.stringify(required)}, User has: ${JSON.stringify(userPermissions)}, Role: ${user?.role}`
      );
      throw new ForbiddenException('You do not have the required permissions');
    }

    this.logger.debug(`PermissionsGuard: Access granted`);
    return true;
  }
}
