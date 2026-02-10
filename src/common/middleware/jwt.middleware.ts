/**
 * JWT Authentication Middleware
 * Uses shared JwtHelperService + AuthService (same flow as JwtAuthGuard).
 */

import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { JwtHelperService } from 'src/common/jwt';
import { AuthService } from 'src/modules/auth/auth.service';
import { RequestWithUser } from 'src/modules/auth/interfaces';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtHelper: JwtHelperService,
    private readonly authService: AuthService,
  ) {}

  async use(req: RequestWithUser, _res: Response, next: NextFunction): Promise<void> {
    const token = this.jwtHelper.extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const payload = this.jwtHelper.verifyToken(token);

    const userValidation = await this.authService.validateToken(payload.sub);
    if (!userValidation.valid) {
      throw new UnauthorizedException('User not found or has been deleted');
    }

    req.user = this.jwtHelper.buildRequestUser(payload);
    next();
  }
}
