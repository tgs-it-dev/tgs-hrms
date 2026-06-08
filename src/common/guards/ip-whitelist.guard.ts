import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IpWhitelistService } from '../../modules/ip-whitelist/ip-whitelist.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { BYPASS_IP_WHITELIST_KEY } from '../decorators/bypass-ip-whitelist.decorator';
import { UserRole } from '../constants/enums';

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

    const request = context.switchToHttp().getRequest<Request>();
    const rawIp =
      (request as Request & { clientIp?: string }).clientIp ||
      request.ip ||
      '0.0.0.0';
    const clientIp = normalizeIp(rawIp);
    const tenantId = (
      request as Request & { user?: { tenant_id?: string; role?: string } }
    ).user?.tenant_id;
    const userRole = (
      request as Request & { user?: { tenant_id?: string; role?: string } }
    ).user?.role;

    if (!tenantId) {
      this.logger.debug('No tenant_id in request, skipping IP whitelist check');
      return true;
    }

    const adminRoles: string[] = [UserRole.ADMIN, UserRole.SYSTEM_ADMIN];
    if (userRole && adminRoles.includes(userRole)) {
      this.logger.debug(
        `IP check skipped for ${userRole} (tenant: ${tenantId})`,
      );
      return true;
    }

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

function normalizeIp(ip: string): string {
  // Strip IPv6-mapped IPv4 prefix (::ffff:192.168.1.1 → 192.168.1.1)
  const ipv4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
  const match = ipv4Mapped.exec(ip);
  return match ? match[1] : ip;
}
