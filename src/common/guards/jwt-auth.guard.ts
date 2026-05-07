import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { GLOBAL_SYSTEM_TENANT_ID } from "../constants/enums";

interface AccessTokenPayload {
  sub: string;
  sid?: string;
  tenant_id?: string;
  email: string;
  role: string;
  permissions: string[];
  first_name: string;
  last_name: string;
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

/**
 * Global JWT authentication guard (registered as APP_GUARD).
 *
 * Per-request checks (one optimised DB query):
 *  1. JWT signature & expiry             — stateless (no DB)
 *  2. Session not revoked                — user_tokens.is_revoked (via sid claim)
 *  3. User still exists                  — users table
 *  4. Tenant not suspended / deleted     — tenants table (skipped for system-admin)
 *
 * Routes decorated with @Public() bypass all checks.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("No token provided");
    }

    const token = authHeader.substring(7);

    // ── 1. Verify signature & expiry ───────────────────────────────────────────
    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const isSystemAdmin = payload.tenant_id === GLOBAL_SYSTEM_TENANT_ID;

    // ── 2 & 3 & 4. Single DB query: session + user + tenant ───────────────────
    await this.validateSession(
      payload.sub,
      payload.sid,
      payload.tenant_id,
      isSystemAdmin,
    );

    request["user"] = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id,
      permissions: payload.permissions ?? [],
      first_name: payload.first_name,
      last_name: payload.last_name,
    };

    return true;
  }

  private async validateSession(
    userId: string,
    sessionId: string | undefined,
    tenantId: string | undefined,
    isSystemAdmin: boolean,
  ): Promise<void> {
    if (sessionId) {
      // One JOIN query covers session revocation + user existence + tenant status.
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
        throw new UnauthorizedException(
          "Session not found. Please log in again.",
        );
      }

      const row = rows[0];

      if (row.session_revoked) {
        throw new UnauthorizedException(
          "Session has been revoked. Please log in again.",
        );
      }

      if (!row.user_exists) {
        throw new UnauthorizedException("User account no longer exists.");
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
      throw new UnauthorizedException("User account no longer exists.");
    }

    if (!isSystemAdmin && tenantId) {
      this.checkTenantStatus(rows[0].tenant_status, rows[0].tenant_deleted_at);
    }
  }

  private checkTenantStatus(
    status: string | null,
    deletedAt: string | null,
  ): void {
    if (deletedAt) {
      throw new UnauthorizedException(
        "Your organization account has been deleted. Please contact support.",
      );
    }
    if (status === "suspended") {
      throw new UnauthorizedException(
        "Your organization account has been suspended. Please contact support.",
      );
    }
  }
}
