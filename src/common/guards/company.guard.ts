import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    return Boolean(request.user?.tenantId);
  }
}
