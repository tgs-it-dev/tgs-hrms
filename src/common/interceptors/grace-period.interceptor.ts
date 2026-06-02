import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types/request.types';

/**
 * Appends the `X-Grace-Period: true` response header when the
 * SubscriptionGuard has flagged the request as operating within a
 * billing grace period.
 */
@Injectable()
export class GracePeriodInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = ctx.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        if (request.gracePeriod) {
          response.setHeader('X-Grace-Period', 'true');
        }
      }),
    );
  }
}
