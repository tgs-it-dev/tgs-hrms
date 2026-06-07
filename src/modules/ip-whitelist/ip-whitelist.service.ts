import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantIpWhitelist } from '../../entities/tenant-ip-whitelist.entity';
import {
  TenantSettingsService,
  TenantSettingKey,
} from '../tenant-settings/tenant-settings.service';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';

@Injectable()
export class IpWhitelistService {
  private readonly logger = new Logger(IpWhitelistService.name);
  private readonly cache = new Map<string, Set<string>>();

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
    const existing = await this.repo.findOne({
      where: { tenant_id: tenantId, ip_address: ipAddress },
    });

    if (existing) {
      throw new ConflictException(
        `IP address ${ipAddress} is already whitelisted`,
      );
    }

    const whitelist = this.repo.create({
      tenant_id: tenantId,
      ip_address: ipAddress,
      description: description || null,
    });

    const saved = await this.repo.save(whitelist);
    this.invalidate(tenantId);
    this.logger.log(
      `IP ${ipAddress} added to whitelist for tenant ${tenantId}`,
    );
    return saved;
  }

  async removeIpFromWhitelist(
    tenantId: string,
    ipAddress: string,
  ): Promise<{ deleted: true; ip_address: string }> {
    await this.repo.delete({
      tenant_id: tenantId,
      ip_address: ipAddress,
    });
    this.invalidate(tenantId);
    this.logger.log(
      `IP ${ipAddress} removed from whitelist for tenant ${tenantId}`,
    );
    return { deleted: true, ip_address: ipAddress };
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

    const whitelistedIps = await this.loadTenant(tenantId);
    return whitelistedIps.has(ipAddress);
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  private async loadTenant(tenantId: string): Promise<Set<string>> {
    if (this.cache.has(tenantId)) {
      return this.cache.get(tenantId)!;
    }

    const ips = await this.repo.find({
      where: { tenant_id: tenantId },
      select: ['ip_address'],
    });

    const ipSet = new Set(ips.map((row) => row.ip_address));
    this.cache.set(tenantId, ipSet);
    return ipSet;
  }
}
