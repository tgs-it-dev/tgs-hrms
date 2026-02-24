import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GLOBAL_SYSTEM_TENANT_ID, UserRole } from '../constants';
import type { AuthenticatedRequest } from 'src/modules/auth/interfaces';

export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const user = request.user;
  if ((user?.role as UserRole) === UserRole.SYSTEM_ADMIN) return GLOBAL_SYSTEM_TENANT_ID;
  return user?.tenant_id ?? '';
});
