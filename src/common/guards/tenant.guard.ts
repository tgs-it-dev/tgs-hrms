import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthenticatedRequest } from '../types/request.types';
import { GLOBAL_SYSTEM_TENANT_ID } from '../constants/enums';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.user?.tenant_id;

    if (!tenantId) return false;

    // System admin is not scoped to any tenant.
    if (tenantId === GLOBAL_SYSTEM_TENANT_ID) return true;

    const row = await this.dataSource.query<
      Array<{ status: string; deleted_at: string | null }>
    >(`SELECT status, deleted_at FROM tenants WHERE id = $1 LIMIT 1`, [
      tenantId,
    ]);

    if (!row.length || row[0].deleted_at !== null) {
      throw new UnauthorizedException('Tenant not found');
    }

    if (row[0].status !== 'active') {
      throw new UnauthorizedException('Tenant account is not active');
    }

    return true;
  }
}
