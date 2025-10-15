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

  validate(payload: { sub: string; tenant_id: string; role: string , email : string }) {
    // ✅ return role so RolesGuard can read it
   return {
    email: payload.email,
    sub: payload.sub,
    role: payload.role,
    tenant_id: payload.tenant_id,
  };
  }
}
