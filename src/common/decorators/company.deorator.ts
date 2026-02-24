import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GLOBAL_SYSTEM_TENANT_ID, UserRole, VALIDATION_ERROR } from '../constants';
import type { AuthenticatedRequest } from 'src/modules/auth/interfaces';

/**
 * Parameter decorator that resolves the current request's tenant ID.
 * Use only on routes protected by JwtAuthGuard (and typically TenantGuard).
 * - System admins: returns GLOBAL_SYSTEM_TENANT_ID.
 * - Other users: returns user.tenant_id; throws if user or tenant_id is missing.
 */
export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const user = request.user;
  if (!user) {
    throw new UnauthorizedException(VALIDATION_ERROR.TENANT_ID_REQUIRED);
  }
  if ((user.role as UserRole) === UserRole.SYSTEM_ADMIN) {
    return GLOBAL_SYSTEM_TENANT_ID;
  }
  const tenantId = user.tenant_id;
  if (tenantId == null || tenantId === '') {
    throw new UnauthorizedException(VALIDATION_ERROR.TENANT_ID_REQUIRED);
  }
  return tenantId;
});
