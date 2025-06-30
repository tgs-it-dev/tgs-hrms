import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'), // or .get(...)!
    });
  }

  validate(payload: { sub: string; tenantId: string; role: string }) {
    // ✅ return role so RolesGuard can read it
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,   // ← critical line
    };
  }
}
