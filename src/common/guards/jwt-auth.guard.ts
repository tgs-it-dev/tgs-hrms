import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Thin wrapper so we can reference a class instead
 * of repeating AuthGuard('jwt') everywhere.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
