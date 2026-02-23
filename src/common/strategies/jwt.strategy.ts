import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AUTH_MESSAGES } from '../constants';
import { JwtHelperService } from '../jwt';
import { TokenValidationService } from '../services/token-validation.service';
import type { JwtPayload } from '../jwt/interfaces';

/**
 * Passport JWT strategy: extract & verify token, then validate user via TokenValidationService.
 * Single place for "verify + user load"; used by AuthGuard('jwt') and optionally by middleware.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly tokenValidation: TokenValidationService,
    private readonly jwtHelper: JwtHelperService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (
        _req: unknown,
        _rawJwtToken: string,
        done: (err: Error | null, secret?: string) => void,
      ) => {
        done(null, this.configService.get<string>('JWT_SECRET'));
      },
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const validation = await this.tokenValidation.validateUser(payload.sub);
    if (!validation.valid) {
      throw new UnauthorizedException(AUTH_MESSAGES.USER_NOT_FOUND_OR_DELETED);
    }
    return this.jwtHelper.buildRequestUser(payload);
  }
}
