
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

    
    if (user.role?.name === 'system-admin') return true;

    
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant access denied: tenant ID missing');
    }

    
    return true;
  }
}
