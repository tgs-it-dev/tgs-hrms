import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    return Boolean(request.user?.tenantId);
  }
}

// New RolesGuard
export function Roles(...roles: string[]) {
  return (target: any, key?: any, descriptor?: any) => {
    Reflect.defineMetadata('roles', roles, descriptor ? descriptor.value : target);
    return descriptor || target;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const handler = context.getHandler();
    const requiredRoles = Reflect.getMetadata('roles', handler) as string[];
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('You do not have permission (role) to perform this action');
    }
    return true;
  }
}
