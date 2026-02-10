import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtHelperService } from 'src/common/jwt';
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
      throw new UnauthorizedException('No token provided');
    }

    const payload = this.jwtHelper.verifyToken(token);

    const userValidation = await this.authService.validateToken(payload.sub);
    if (!userValidation.valid) {
      throw new UnauthorizedException('User not found or has been deleted');
    }

    request.user = this.jwtHelper.buildRequestUser(payload);
    return true;
  }
}
