import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>
  ) {}

  /**
   * Get all tenants with pagination
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 25)
   * @param includeDeleted - Include soft-deleted tenants (default: false)
   * @returns Paginated list of tenants
   */
  async findAll(page: number = 1, limit: number = 25, includeDeleted: boolean = false): Promise<PaginationResponse<Tenant>> {
    const skip = (page - 1) * limit;
    
    // Filter out deleted tenants by default (professional practice)
    // TypeORM's DeleteDateColumn automatically excludes deleted records unless withDeleted is true
    const [items, total] = await this.tenantRepo.findAndCount({
      where: includeDeleted ? {} : { deleted_at: IsNull() },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
      withDeleted: includeDeleted,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Find a tenant by ID
   * @param id - Tenant UUID
   * @param includeDeleted - Include soft-deleted tenants (default: false)
   * @returns Tenant entity
   * @throws NotFoundException if tenant not found or is deleted
   */
  async findOne(id: string, includeDeleted: boolean = false): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ 
      where: { id },
      withDeleted: includeDeleted,
    });
    
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    
    // Additional check: if tenant is deleted and we're not including deleted
    if (tenant.deleted_at && !includeDeleted) {
      throw new NotFoundException('Tenant has been deleted');
    }
    
    return tenant;
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const tenant = this.tenantRepo.create(dto);
    return this.tenantRepo.save(tenant);
  }

  /**
   * Update a tenant
   * @param id - Tenant UUID
   * @param dto - Update data
   * @returns Updated tenant
   * @throws NotFoundException if tenant not found
   * @throws BadRequestException if trying to update deleted tenant
   */
  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    
    // Prevent updating deleted tenants
    if (tenant.deleted_at) {
      throw new BadRequestException('Cannot update a deleted tenant. Please restore it first.');
    }
    
    Object.assign(tenant, dto);
    return this.tenantRepo.save(tenant);
  }

  /**
   * Soft delete a tenant
   * @param id - Tenant UUID
   * @returns Deletion confirmation
   * @throws NotFoundException if tenant not found
   * @throws BadRequestException if tenant is already deleted
   */
  async remove(id: string): Promise<{ deleted: true; id: string }> {
    // Find tenant including deleted ones to check status
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    
    // Check if already deleted (professional error handling)
    if (tenant.deleted_at) {
      throw new BadRequestException('Tenant is already deleted');
    }
    
    // Soft delete: Mark tenant as deleted instead of hard delete
    // This preserves employee data for import info while preventing login
    tenant.deleted_at = new Date();
    tenant.status = 'suspended';
    
    await this.tenantRepo.save(tenant);
    return { deleted: true, id };
  }

  /**
   * Restore a soft-deleted tenant
   * @param id - Tenant UUID
   * @returns Restored tenant
   * @throws NotFoundException if tenant not found
   * @throws BadRequestException if tenant is not deleted
   */
  async restore(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    
    if (!tenant.deleted_at) {
      throw new BadRequestException('Tenant is not deleted');
    }
    
    // Restore tenant
    tenant.deleted_at = null;
    tenant.status = 'active';
    
    return this.tenantRepo.save(tenant);
  }
}
