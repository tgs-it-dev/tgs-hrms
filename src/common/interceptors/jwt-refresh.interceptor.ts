import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRefreshInterceptor implements NestInterceptor {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Check if the error is due to JWT expiration
        if (error instanceof UnauthorizedException && error.message === 'Unauthorized') {
          const request = context.switchToHttp().getRequest();
          const authHeader = request.headers.authorization;

          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            try {
              // Try to decode the token to check if it's expired
              const decoded = this.jwtService.decode(token);
              if (decoded && typeof decoded === 'object' && decoded.exp) {
                const currentTime = Math.floor(Date.now() / 1000);
                if (decoded.exp < currentTime) {
                  // Token is expired, return a specific error message
                  return throwError(
                    () =>
                      new UnauthorizedException({
                        message: 'Access token expired',
                        code: 'TOKEN_EXPIRED',
                        shouldRefresh: true,
                      })
                  );
                }
              }
            } catch (decodeError) {
              // Token is malformed
              return throwError(
                () =>
                  new UnauthorizedException({
                    message: 'Invalid access token',
                    code: 'INVALID_TOKEN',
                  })
              );
            }
          }
        }

        return throwError(() => error);
      })
    );
  }
}
