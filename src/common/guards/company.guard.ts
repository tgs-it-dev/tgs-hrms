import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
   // Optionally accept allowed roles for future RBACAdd
  // constructor(private allowedRoles?: string[]) {}
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
      // In future, check user roles here if allowedRoles is set
    return Boolean(request.user?.tenantId);
  }
}
// This guard can be extended to check user roles for RBAC.