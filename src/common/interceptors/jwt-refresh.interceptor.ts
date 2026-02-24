import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { JwtHelperService } from 'src/common/jwt';
import { AUTH_MESSAGES } from '../constants';

interface DecodedPayload {
  exp?: number;
}

@Injectable()
export class JwtRefreshInterceptor implements NestInterceptor {
  constructor(private readonly jwtHelper: JwtHelperService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof UnauthorizedException && error.message === AUTH_MESSAGES.UNAUTHORIZED) {
          const request = context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>();
          const token = this.jwtHelper.extractBearerToken(request.headers?.authorization);

          if (token) {
            const decoded = this.jwtHelper.decodeToken<DecodedPayload>(token);
            if (decoded?.exp) {
              const currentTime = Math.floor(Date.now() / 1000);
              if (decoded.exp < currentTime) {
                return throwError(
                  () =>
                    new UnauthorizedException({
                      message: AUTH_MESSAGES.ACCESS_TOKEN_EXPIRED,
                      code: AUTH_MESSAGES.TOKEN_EXPIRED,
                      shouldRefresh: true,
                    }),
                );
              }
            } else {
              return throwError(
                () =>
                  new UnauthorizedException({
                    message: AUTH_MESSAGES.INVALID_ACCESS_TOKEN,
                    code: AUTH_MESSAGES.INVALID_TOKEN_CODE,
                  }),
              );
            }
          }
        }
        return throwError(() => error);
      }),
    );
  }
}
