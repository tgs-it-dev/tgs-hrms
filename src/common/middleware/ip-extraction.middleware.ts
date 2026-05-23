import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class IpExtractionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpExtractionMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const clientIp = this.extractClientIp(req);
    Object.assign(req, { clientIp });
    this.logger.debug(`Client IP extracted: ${clientIp}`);
    next();
  }

  private extractClientIp(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor.split(',')[0];
      return ips.trim();
    }

    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }

    return req.ip || req.socket.remoteAddress || '0.0.0.0';
  }
}
