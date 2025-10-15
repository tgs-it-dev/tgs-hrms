import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    this.logger.log(
      `PermissionsGuard: Required permissions: ${JSON.stringify(required)}`,
    );

    if (!required || required.length === 0) {
      this.logger.log(
        `PermissionsGuard: No permissions required, allowing access`,
      );
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { permissions?: string[] };

    this.logger.log(`PermissionsGuard: User object: ${JSON.stringify(user)}`);
    this.logger.log(
      `PermissionsGuard: User permissions: ${JSON.stringify(user?.permissions)}`,
    );

    const userPermissions = (user?.permissions || []).map((p) =>
      p.toLowerCase(),
    );
    this.logger.log(
      `PermissionsGuard: Normalized user permissions: ${JSON.stringify(userPermissions)}`,
    );

    // Check if user is admin-equivalent (admin or system-admin) -> has all permissions
    const role = (request.user?.role || "").toLowerCase();
    const isAdminEquivalent =
      role === "system-admin" || role === "admin" || role === "network-admin";

    let allowed = false;
    if (isAdminEquivalent) {
      // Admin-equivalent has access to everything
      allowed = true;
      this.logger.log(`PermissionsGuard: Admin-equivalent access granted`);
    } else {
      // Regular users need to have all required permissions
      allowed = required.every((perm) =>
        userPermissions.includes(perm.toLowerCase()),
      );
      this.logger.log(
        `PermissionsGuard: Regular user permission check result - allowed: ${allowed}`,
      );
    }

    if (!allowed) {
      this.logger.warn(
        `PermissionsGuard: Access denied. Required: ${JSON.stringify(required)}, User has: ${JSON.stringify(userPermissions)}, Role: ${request.user?.role}`,
      );
      throw new ForbiddenException("You do not have the required permissions");
    }

    this.logger.log(`PermissionsGuard: Access granted`);
    return true;
  }
}
