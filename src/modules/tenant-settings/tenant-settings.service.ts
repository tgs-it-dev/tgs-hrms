import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantSetting } from '../../entities/tenant-setting.entity';

export enum TenantSettingKey {
  MOBILE_LOGIN_ENABLED = 'mobile_login_enabled',
  LEAVE_WORKFLOW_ENABLED = 'leave_workflow_enabled',
  WFH_WORKFLOW_ENABLED = 'wfh_workflow_enabled',
  OVERTIME_WORKFLOW_ENABLED = 'overtime_workflow_enabled',
}

@Injectable()
export class TenantSettingsService {
  // Per-key defaults — returned when no row exists for a tenant+key.
  // Adding a new setting here requires no DB migration and no per-tenant seeding.
  private static readonly DEFAULTS: Record<string, string> = {
    [TenantSettingKey.MOBILE_LOGIN_ENABLED]: 'true',
    [TenantSettingKey.LEAVE_WORKFLOW_ENABLED]: 'false',
    [TenantSettingKey.WFH_WORKFLOW_ENABLED]: 'false',
    [TenantSettingKey.OVERTIME_WORKFLOW_ENABLED]: 'false',
  };

  // Two-level cache: tenantId → key → value.
  // Populated on first access per tenant (all keys loaded at once).
  private readonly cache = new Map<string, Map<string, string>>();

  constructor(
    @InjectRepository(TenantSetting)
    private readonly repo: Repository<TenantSetting>,
  ) {}

  async getBoolean(tenantId: string, key: TenantSettingKey): Promise<boolean> {
    const value = await this.get(tenantId, key);
    return value === 'true';
  }

  async get(tenantId: string, key: TenantSettingKey): Promise<string> {
    const tenantCache = await this.loadTenant(tenantId);
    return tenantCache.get(key) ?? TenantSettingsService.DEFAULTS[key] ?? 'false';
  }

  async set(tenantId: string, key: TenantSettingKey, value: string): Promise<void> {
    await this.repo.upsert(
      { tenant_id: tenantId, key, value },
      { conflictPaths: ['tenant_id', 'key'], skipUpdateIfNoValuesChanged: true },
    );
    const tenantCache = await this.loadTenant(tenantId);
    tenantCache.set(key, value);
  }

  async getAll(tenantId: string): Promise<Record<string, string>> {
    const tenantCache = await this.loadTenant(tenantId);
    const result: Record<string, string> = { ...TenantSettingsService.DEFAULTS };
    tenantCache.forEach((value, key) => { result[key] = value; });
    return result;
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  // Loads all settings for a tenant from DB into the cache on first call.
  private async loadTenant(tenantId: string): Promise<Map<string, string>> {
    if (this.cache.has(tenantId)) return this.cache.get(tenantId)!;
    const rows = await this.repo.find({ where: { tenant_id: tenantId } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    this.cache.set(tenantId, map);
    return map;
  }
}
