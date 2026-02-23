import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GLOBAL_SYSTEM_TENANT_ID, UserRole } from '../constants';

export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  if (user?.role === UserRole.SYSTEM_ADMIN) return GLOBAL_SYSTEM_TENANT_ID;
  return user?.tenant_id;
});
