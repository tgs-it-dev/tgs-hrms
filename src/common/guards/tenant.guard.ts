import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return Boolean(user?.tenant_id); // only allow if tenant_id is present
  }
}

