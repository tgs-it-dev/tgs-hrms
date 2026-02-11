/**
 * JWT Authentication Middleware
 * Uses shared JwtHelperService + TokenValidationService (same flow as JwtAuthGuard).
 */

import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { JwtHelperService } from 'src/common/jwt';
import { TokenValidationService } from 'src/common/services/token-validation.service';
import { AuthenticatedRequest } from 'src/modules/auth/interfaces';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtHelper: JwtHelperService,
    private readonly tokenValidationService: TokenValidationService,
  ) {}

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
    const token = this.jwtHelper.extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const payload = this.jwtHelper.verifyToken(token);

    const userValidation = await this.tokenValidationService.validateToken(payload.sub);
    if (!userValidation.valid) {
      throw new UnauthorizedException('User not found or has been deleted');
    }

    req.user = this.jwtHelper.buildRequestUser(payload);
    next();
  }
}
