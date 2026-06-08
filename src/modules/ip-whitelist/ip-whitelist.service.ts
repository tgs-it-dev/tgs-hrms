import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantIpWhitelist } from '../../entities/tenant-ip-whitelist.entity';
import {
  TenantSettingsService,
  TenantSettingKey,
} from '../tenant-settings/tenant-settings.service';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  ips: Set<string>;
  cachedAt: number;
}

function normalizeIp(ip: string): string {
  const ipv4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
  const match = ipv4Mapped.exec(ip);
  return match ? match[1] : ip;
}

@Injectable()
export class IpWhitelistService {
  private readonly logger = new Logger(IpWhitelistService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(TenantIpWhitelist)
    private readonly repo: Repository<TenantIpWhitelist>,
    private readonly tenantSettings: TenantSettingsService,
  ) {}

  async isIpRestrictionEnabled(tenantId: string): Promise<boolean> {
    try {
      const setting = await this.tenantSettings.get(
        tenantId,
        TenantSettingKey.IP_RESTRICTION_ENABLED,
      );
      return setting === 'true';
    } catch {
      return false;
    }
  }

  async enableIpRestriction(tenantId: string): Promise<void> {
    await this.tenantSettings.set(
      tenantId,
      TenantSettingKey.IP_RESTRICTION_ENABLED,
      'true',
    );
    this.invalidate(tenantId);
  }

  async disableIpRestriction(tenantId: string): Promise<void> {
    await this.tenantSettings.set(
      tenantId,
      TenantSettingKey.IP_RESTRICTION_ENABLED,
      'false',
    );
    this.invalidate(tenantId);
  }

  async addIpToWhitelist(
    tenantId: string,
    ipAddress: string,
    description?: string,
  ): Promise<TenantIpWhitelist> {
    const normalized = normalizeIp(ipAddress);

    const existing = await this.repo.findOne({
      where: { tenant_id: tenantId, ip_address: normalized },
    });

    if (existing) {
      throw new ConflictException(
        `IP address ${normalized} is already whitelisted`,
      );
    }

    const whitelist = this.repo.create({
      tenant_id: tenantId,
      ip_address: normalized,
      description: description || null,
    });

    const saved = await this.repo.save(whitelist);
    this.invalidate(tenantId);
    this.logger.log(
      `IP ${normalized} added to whitelist for tenant ${tenantId}`,
    );
    return saved;
  }

  async removeIpFromWhitelist(
    tenantId: string,
    ipAddress: string,
  ): Promise<{ deleted: true; ip_address: string }> {
    const normalized = normalizeIp(ipAddress);
    await this.repo.delete({
      tenant_id: tenantId,
      ip_address: normalized,
    });
    this.invalidate(tenantId);
    this.logger.log(
      `IP ${normalized} removed from whitelist for tenant ${tenantId}`,
    );
    return { deleted: true, ip_address: normalized };
  }

  async getWhitelistedIps(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginationResponse<TenantIpWhitelist>> {
    const skip = (page - 1) * limit;
    const [items, total] = await this.repo.findAndCount({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async isIpWhitelisted(tenantId: string, ipAddress: string): Promise<boolean> {
    const isEnabled = await this.isIpRestrictionEnabled(tenantId);
    if (!isEnabled) {
      return true;
    }

    const normalized = normalizeIp(ipAddress);
    const whitelistedIps = await this.loadTenant(tenantId);
    return whitelistedIps.has(normalized);
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  private async loadTenant(tenantId: string): Promise<Set<string>> {
    const entry = this.cache.get(tenantId);
    if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
      return entry.ips;
    }

    const ips = await this.repo.find({
      where: { tenant_id: tenantId },
      select: ['ip_address'],
    });

    const ipSet = new Set(ips.map((row) => normalizeIp(row.ip_address)));
    this.cache.set(tenantId, { ips: ipSet, cachedAt: Date.now() });
    return ipSet;
  }
}
