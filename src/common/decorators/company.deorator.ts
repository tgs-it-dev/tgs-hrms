import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GLOBAL_SYSTEM_TENANT_ID } from '../constants/enums';

export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  
  // System-admin users always use the global system tenant ID
  if (user?.role === 'system-admin') {
    return GLOBAL_SYSTEM_TENANT_ID;
  }
  
  return user?.tenant_id; 
});
