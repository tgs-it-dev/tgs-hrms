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

    const request = context.switchToHttp().getRequest();
    const clientIp = request.clientIp || request.ip || '0.0.0.0';
    const tenantId = request.user?.tenant_id;

    if (!tenantId) {
      this.logger.debug('No tenant_id in request, skipping IP whitelist check');
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
