import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtHelperService } from 'src/common/jwt';
import { AUTH_MESSAGES } from 'src/common/constants/auth-messages';
import { TokenValidationService } from 'src/common/services/token-validation.service';
import { AuthenticatedRequest } from 'src/modules/auth/interfaces';

/**
 * JWT Authentication Guard – single place for HTTP JWT auth.
 * Uses JwtHelperService (extract + verify) and TokenValidationService (validate user).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtHelper: JwtHelperService,
    private readonly tokenValidationService: TokenValidationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.jwtHelper.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException(AUTH_MESSAGES.NO_TOKEN_PROVIDED);
    }

    const payload = this.jwtHelper.verifyToken(token);
    const userValidation = await this.tokenValidationService.validateToken(payload.sub);
    if (!userValidation.valid) {
      throw new UnauthorizedException(AUTH_MESSAGES.USER_NOT_FOUND_OR_DELETED);
    }

    request.user = this.jwtHelper.buildRequestUser(payload);
    return true;
  }
}
