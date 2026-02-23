import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedRequest } from 'src/modules/auth/interfaces';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    return Boolean(user?.tenant_id);
  }
}
