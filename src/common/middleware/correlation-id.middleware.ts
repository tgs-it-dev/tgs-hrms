import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { HTTP_HEADER } from '../constants';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingId = req.headers[HTTP_HEADER.CORRELATION_ID] as string | undefined;
    const correlationId = existingId || uuidv4();
    req.headers[HTTP_HEADER.CORRELATION_ID] = correlationId;
    res.setHeader(HTTP_HEADER.CORRELATION_ID_RESPONSE, correlationId);
    next();
  }
}
