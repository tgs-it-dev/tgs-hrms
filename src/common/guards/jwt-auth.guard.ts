import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtHelperService } from 'src/common/jwt';
import { AUTH_MESSAGES } from 'src/common/constants/auth-messages';
import { AuthService } from 'src/modules/auth/auth.service';
import { RequestWithUser } from 'src/modules/auth/interfaces';

/**
 * JWT Authentication Guard – single place for HTTP JWT auth.
 * Uses JwtHelperService (extract + verify) and AuthService (validate user).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtHelper: JwtHelperService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const token = this.jwtHelper.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException(AUTH_MESSAGES.NO_TOKEN_PROVIDED);
    }

    const payload = this.jwtHelper.verifyToken(token);
    const userValidation = await this.authService.validateToken(payload.sub);
    if (!userValidation.valid) {
      throw new UnauthorizedException(AUTH_MESSAGES.USER_NOT_FOUND_OR_DELETED);
    }

    request.user = this.jwtHelper.buildRequestUser(payload);
    return true;
  }
}
