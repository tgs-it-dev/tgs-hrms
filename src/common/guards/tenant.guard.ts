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

    // System admin has global access
    if (user.role?.name === 'system-admin') return true;

    const tenantIdInParams = request.params.tenantId || request.body.tenant_id;

    if (!tenantIdInParams || user.tenantId !== tenantIdInParams) {
      throw new ForbiddenException('Tenant access denied');
    }

    return true;
  }
}
