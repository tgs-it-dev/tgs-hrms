
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantIdFromRequest = parseInt(request.params.tenantId || request.query.tenantId);

    if (user.tenantId !== tenantIdFromRequest) {
      throw new ForbiddenException('Access denied for this tenant');
    }
    return true;
  }
}
