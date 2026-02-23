import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AUTH_MESSAGES } from 'src/common/constants';

/**
 * JWT Auth guard using Passport JwtStrategy.
 * Use @UseGuards(JwtAuthGuard); request.user is set by JwtStrategy.validate().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser, _info: unknown): TUser {
    if (err) throw err;
    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.NO_TOKEN_PROVIDED);
    }
    return user;
  }
}
