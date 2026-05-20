import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GLOBAL_SYSTEM_TENANT_ID } from '../../../common/constants/enums';

interface AccessTokenPayload {
  sub: string;
  sid?: string;
  tenant_id?: string;
  email: string;
  role: string;
  permissions: string[];
  first_name: string;
  last_name: string;
  is_mobile?: boolean;
}

interface SessionRow {
  session_revoked: boolean;
  user_exists: boolean;
  tenant_status: string | null;
  tenant_deleted_at: string | null;
}

interface UserRow {
  user_exists: boolean;
  tenant_status: string | null;
  tenant_deleted_at: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  async validate(payload: AccessTokenPayload): Promise<Record<string, unknown>> {
    const isSystemAdmin = payload.tenant_id === GLOBAL_SYSTEM_TENANT_ID;
    await this.validateSession(payload.sub, payload.sid, payload.tenant_id, isSystemAdmin);

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id,
      permissions: payload.permissions ?? [],
      first_name: payload.first_name,
      last_name: payload.last_name,
      is_mobile: payload.is_mobile ?? false,
    };
  }

  private async validateSession(
    userId: string,
    sessionId: string | undefined,
    tenantId: string | undefined,
    isSystemAdmin: boolean,
  ): Promise<void> {
    if (sessionId) {
      const rows = await this.dataSource.query<SessionRow[]>(
        `SELECT
           ut.is_revoked            AS session_revoked,
           (u.id IS NOT NULL)       AS user_exists,
           t.status                 AS tenant_status,
           t.deleted_at             AS tenant_deleted_at
         FROM user_tokens ut
         LEFT JOIN users   u ON u.id  = ut.user_id
         LEFT JOIN tenants t ON t.id  = u.tenant_id
         WHERE ut.id = $1
           AND ut.user_id = $2`,
        [sessionId, userId],
      );

      if (!rows.length) {
        throw new UnauthorizedException('Session not found. Please log in again.');
      }

      const row = rows[0];

      if (row.session_revoked) {
        throw new UnauthorizedException('Session has been revoked. Please log in again.');
      }

      if (!row.user_exists) {
        throw new UnauthorizedException('User account no longer exists.');
      }

      if (!isSystemAdmin) {
        this.checkTenantStatus(row.tenant_status, row.tenant_deleted_at);
      }

      return;
    }

    // Fallback for tokens without sid (e.g. issued by signup flow).
    const rows = await this.dataSource.query<UserRow[]>(
      `SELECT
         (u.id IS NOT NULL)  AS user_exists,
         t.status            AS tenant_status,
         t.deleted_at        AS tenant_deleted_at
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [userId],
    );

    if (!rows.length || !rows[0].user_exists) {
      throw new UnauthorizedException('User account no longer exists.');
    }

    if (!isSystemAdmin && tenantId) {
      this.checkTenantStatus(rows[0].tenant_status, rows[0].tenant_deleted_at);
    }
  }

  private checkTenantStatus(status: string | null, deletedAt: string | null): void {
    if (deletedAt) {
      throw new UnauthorizedException(
        'Your organization account has been deleted. Please contact support.',
      );
    }
    if (status === 'suspended') {
      throw new UnauthorizedException(
        'Your organization account has been suspended. Please contact support.',
      );
    }
  }
}
