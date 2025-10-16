/**
 * JWT Authentication Middleware
 * Handles JWT token validation and user authentication
 */

import { Injectable, NestMiddleware, UnauthorizedException, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('No token provided');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify JWT token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'default_secret',
      });

      // Validate user exists and is active
      const userValidation = await this.authService.validateToken(payload.sub);
      if (!userValidation.valid) {
        throw new UnauthorizedException('User not found or has been deleted');
      }

      // Attach user information to request
      req['user'] = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        tenant_id: payload.tenant_id,
        permissions: payload.permissions || [],
        first_name: payload.first_name,
        last_name: payload.last_name,
      };

      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}

/**
 * JWT Authentication Guard
 * Can be used as a guard instead of middleware
 */

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('No token provided');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify JWT token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'default_secret',
      });

      // Validate user exists and is active
      const userValidation = await this.authService.validateToken(payload.sub);
      if (!userValidation.valid) {
        throw new UnauthorizedException('User not found or has been deleted');
      }

      // Attach user information to request
      request['user'] = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        tenant_id: payload.tenant_id,
        permissions: payload.permissions || [],
        first_name: payload.first_name,
        last_name: payload.last_name,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}

/**
 * JWT Token Validation Utility
 * Standalone utility for token validation
 */
export class JwtTokenValidator {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async validateToken(token: string): Promise<{
    valid: boolean;
    user?: any;
    error?: string;
  }> {
    try {
      // Verify JWT token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'default_secret',
      });

      // Validate user exists and is active
      const userValidation = await this.authService.validateToken(payload.sub);
      if (!userValidation.valid) {
        return {
          valid: false,
          error: 'User not found or has been deleted',
        };
      }

      return {
        valid: true,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          tenant_id: payload.tenant_id,
          permissions: payload.permissions || [],
          first_name: payload.first_name,
          last_name: payload.last_name,
        },
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid token',
      };
    }
  }

  async extractUserFromToken(token: string): Promise<any> {
    const result = await this.validateToken(token);
    return result.valid ? result.user : null;
  }
}
