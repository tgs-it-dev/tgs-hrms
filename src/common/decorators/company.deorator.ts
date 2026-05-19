import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GLOBAL_SYSTEM_TENANT_ID } from '../constants/enums';
import { AuthenticatedRequest } from '../types/request.types';

export function extractTenantId(_: unknown, ctx: ExecutionContext): string {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const user = request.user;

  if (user?.role === 'system-admin') {
    return GLOBAL_SYSTEM_TENANT_ID;
  }

  return user?.tenant_id;
}

export const TenantId = createParamDecorator(extractTenantId);
