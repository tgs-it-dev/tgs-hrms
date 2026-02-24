import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './interfaces';
import { AUTH_MESSAGES, BEARER_PREFIX } from '../constants';

/**
 * JWT helper for non–request-auth flows.
 * Request auth (extract + verify + user load) is handled by Passport JwtStrategy.
 * Use this for: refresh/logout token verify, decode (e.g. interceptor), buildRequestUser (used by JwtStrategy).
 */
@Injectable()
export class JwtHelperService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Extract Bearer token from Authorization header.
   * @returns token string or null if missing/invalid format
   */
  extractBearerToken(authorizationHeader: string | undefined): string | null {
    if (!authorizationHeader || typeof authorizationHeader !== 'string') {
      return null;
    }
    const trimmed = authorizationHeader.trim();
    if (!trimmed.startsWith(BEARER_PREFIX)) {
      return null;
    }
    const token = trimmed.slice(BEARER_PREFIX.length).trim();
    return token || null;
  }

  /**
   * Verify token and return payload. Throws UnauthorizedException if invalid.
   */
  verifyToken<T extends object = JwtPayload>(token: string): T {
    try {
      const payload = this.jwtService.verify<T>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      return payload;
    } catch {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_TOKEN);
    }
  }

  /**
   * Decode token without verifying (e.g. for checking exp in interceptors).
   * @returns payload or null if decode fails
   */
  decodeToken<T = JwtPayload>(token: string): T | null {
    try {
      const decoded: unknown = this.jwtService.decode(token);
      if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
        return decoded as T;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Build the object to attach to request.user from a JWT payload.
   */
  buildRequestUser(payload: JwtPayload): JwtPayload {
    return {
      id: payload.sub ?? payload.id,
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id ?? null,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      first_name: payload.first_name ?? '',
      last_name: payload.last_name ?? '',
    };
  }
}
