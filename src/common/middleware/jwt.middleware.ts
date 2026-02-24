/**
 * JWT middleware using Passport's same JwtStrategy (passport.authenticate('jwt')).
 * Use for routes that need auth without per-route guard; strategy does verify + user load.
 */

import { UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as passport from 'passport';
import { AUTH_MESSAGES } from 'src/common/constants';
import type { AuthenticatedRequest } from 'src/modules/auth/interfaces';
import type { JwtPayload } from 'src/common/jwt/interfaces';

export function jwtMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authFn = passport.authenticate('jwt', { session: false }, (err: Error | null, user: JwtPayload | false) => {
    if (err) return next(err);
    if (!user) {
      return next(new UnauthorizedException(AUTH_MESSAGES.NO_TOKEN_PROVIDED));
    }
    req.user = user;
    next();
  }) as (req: Request, res: Response, next: NextFunction) => void;
  authFn(req, res, next);
}
