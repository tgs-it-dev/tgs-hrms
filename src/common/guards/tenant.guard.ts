// src/common/guards/tenant.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // ✅ Allow system-admin access to all tenants
    if (user.role?.name === 'system-admin') return true;

    // ✅ Only check if tenantId exists
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant access denied: tenant ID missing');
    }

    // ✅ No need to check against request.params or body anymore
    return true;
  }
}
