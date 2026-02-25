import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';

import { Tenant } from '../../entities/tenant.entity';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';
import { TenantStatus, TENANT_PAGINATION, TENANT_ERRORS } from './constants/tenant.constants';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /**
   * Get all tenants with pagination. Excludes soft-deleted by default.
   */
  async findAll(
    page: number = TENANT_PAGINATION.DEFAULT_PAGE,
    limit: number = TENANT_PAGINATION.DEFAULT_LIMIT,
    includeDeleted: boolean = false,
  ): Promise<PaginationResponse<Tenant>> {
    const skip = (page - 1) * limit;

    const [items, total] = await this.tenantRepo.findAndCount({
      where: includeDeleted ? {} : { deleted_at: IsNull() },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
      withDeleted: includeDeleted,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a tenant by ID. Excludes soft-deleted by default.
   */
  async findOne(id: string, includeDeleted: boolean = false): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });

    if (!tenant) {
      throw new NotFoundException(TENANT_ERRORS.NOT_FOUND);
    }

    if (tenant.deleted_at && !includeDeleted) {
      throw new NotFoundException(TENANT_ERRORS.DELETED);
    }

    return tenant;
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const tenant = this.tenantRepo.create(dto);
    return this.tenantRepo.save(tenant);
  }

  /**
   * Update a tenant. Rejects if tenant is soft-deleted.
   */
  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);

    if (tenant.deleted_at) {
      throw new BadRequestException(TENANT_ERRORS.CANNOT_UPDATE_DELETED);
    }

    Object.assign(tenant, dto);
    return this.tenantRepo.save(tenant);
  }

  /**
   * Soft-delete a tenant. Sets status to suspended.
   */
  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!tenant) {
      throw new NotFoundException(TENANT_ERRORS.NOT_FOUND);
    }

    if (tenant.deleted_at) {
      throw new BadRequestException(TENANT_ERRORS.ALREADY_DELETED);
    }

    tenant.deleted_at = new Date();
    tenant.status = TenantStatus.SUSPENDED;
    await this.tenantRepo.save(tenant);

    return { deleted: true, id };
  }

  /**
   * Restore a soft-deleted tenant. Sets status to active.
   */
  async restore(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!tenant) {
      throw new NotFoundException(TENANT_ERRORS.NOT_FOUND);
    }

    if (!tenant.deleted_at) {
      throw new BadRequestException(TENANT_ERRORS.NOT_DELETED);
    }

    tenant.deleted_at = null;
    tenant.status = TenantStatus.ACTIVE;

    return this.tenantRepo.save(tenant);
  }
}
