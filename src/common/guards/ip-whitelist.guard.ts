import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IpWhitelistService } from '../../modules/ip-whitelist/ip-whitelist.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { BYPASS_IP_WHITELIST_KEY } from '../decorators/bypass-ip-whitelist.decorator';
import { UserRole } from '../constants/enums';
import { AuthenticatedRequest } from '../types/request.types';

const ADMIN_ROLES: ReadonlySet<string> = new Set([
  UserRole.ADMIN,
  UserRole.SYSTEM_ADMIN,
  UserRole.NETWORK_ADMIN,
]);

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);

  constructor(
    private readonly ipWhitelistService: IpWhitelistService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const bypass = this.reflector.getAllAndOverride<boolean>(
      BYPASS_IP_WHITELIST_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (bypass) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.user?.tenant_id;
    const userRole = request.user?.role;

    if (!tenantId) {
      this.logger.debug('No tenant_id in request, skipping IP whitelist check');
      return true;
    }

    if (userRole && ADMIN_ROLES.has(userRole)) {
      this.logger.debug(
        `IP check skipped for ${userRole} (tenant: ${tenantId})`,
      );
      return true;
    }

    // The service owns IP normalization — pass raw clientIp here.
    const clientIp = request.clientIp ?? request.ip ?? '0.0.0.0';

    const isWhitelisted = await this.ipWhitelistService.isIpWhitelisted(
      tenantId,
      clientIp,
    );

    if (!isWhitelisted) {
      this.logger.warn(`IP ${clientIp} not whitelisted for tenant ${tenantId}`);
      throw new ForbiddenException(
        'Your IP address is not authorized to access this resource.',
      );
    }

    return true;
  }
}
