import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class IpExtractionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpExtractionMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Delegate to Express's trust-proxy-aware req.ip rather than re-parsing
    // raw headers. The single source of truth for proxy trust depth is
    // app.set('trust proxy', ...) in main.ts.
    const clientIp = req.ip || req.socket.remoteAddress || '0.0.0.0';
    Object.assign(req, { clientIp });
    this.logger.debug(`Client IP extracted: ${clientIp}`);
    next();
  }
}
