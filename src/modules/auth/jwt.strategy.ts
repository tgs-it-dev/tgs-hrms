import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { JwtPayloadDto } from "./dto/jwt-payload.dto";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>("JWT_SECRET") || "default_secret",
    });
  }

  validate(payload: JwtPayloadDto) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id,
    };
  }
}
