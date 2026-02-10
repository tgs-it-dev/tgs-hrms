import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { JwtHelperService } from 'src/common/jwt';

interface DecodedPayload {
  exp?: number;
}

@Injectable()
export class JwtRefreshInterceptor implements NestInterceptor {
  constructor(private readonly jwtHelper: JwtHelperService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof UnauthorizedException && error.message === 'Unauthorized') {
          const request = context.switchToHttp().getRequest();
          const token = this.jwtHelper.extractBearerToken(request.headers.authorization);

          if (token) {
            const decoded = this.jwtHelper.decodeToken<DecodedPayload>(token);
            if (decoded?.exp) {
              const currentTime = Math.floor(Date.now() / 1000);
              if (decoded.exp < currentTime) {
                return throwError(
                  () =>
                    new UnauthorizedException({
                      message: 'Access token expired',
                      code: 'TOKEN_EXPIRED',
                      shouldRefresh: true,
                    }),
                );
              }
            } else {
              return throwError(
                () =>
                  new UnauthorizedException({
                    message: 'Invalid access token',
                    code: 'INVALID_TOKEN',
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
