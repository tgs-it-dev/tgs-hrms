import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere, In } from 'typeorm';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { getPostgresErrorCode } from '../../common/types/database.types';
import { GLOBAL_SYSTEM_TENANT_ID } from '../../common/constants/enums';
import { DEPARTMENT_MESSAGES } from '../../common/constants/department.constants';
import type { AllDepartmentsAcrossTenantsResult, DepartmentRemoveResult } from './interfaces';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly repo: Repository<Department>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  private requireTenantId(tenant_id: string | null): asserts tenant_id is string {
    if (tenant_id == null || tenant_id === '') {
      throw new BadRequestException(DEPARTMENT_MESSAGES.TENANT_CONTEXT_REQUIRED);
    }
  }

  async create(tenant_id: string | null, dto: CreateDepartmentDto): Promise<Department> {
    this.requireTenantId(tenant_id);
    const existing = await this.repo.findOne({
      where: { name: dto.name, tenant_id },
    });

    if (existing) {
      throw new ConflictException(DEPARTMENT_MESSAGES.ALREADY_EXISTS_IN_COMPANY(dto.name));
    }

    try {
      const department = this.repo.create({
        name: dto.name,
        description: dto.description ?? null,
        tenant_id,
      });

      return await this.repo.save(department);
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException(DEPARTMENT_MESSAGES.NAME_UNIQUE_WITHIN_COMPANY);
      }
      if (errorCode === '23502') {
        throw new BadRequestException(DEPARTMENT_MESSAGES.NAME_REQUIRED);
      }
      throw err;
    }
  }

  async update(tenant_id: string | null, id: string, dto: UpdateDepartmentDto): Promise<Department> {
    this.requireTenantId(tenant_id);
    const department = await this.repo.findOne({ where: { id } });

    if (!department) {
      throw new NotFoundException(DEPARTMENT_MESSAGES.NOT_FOUND_DOT);
    }

    if (department.tenant_id === GLOBAL_SYSTEM_TENANT_ID) {
      throw new BadRequestException(DEPARTMENT_MESSAGES.GLOBAL_CANNOT_MODIFY);
    }

    if (department.tenant_id !== tenant_id) {
      throw new BadRequestException(DEPARTMENT_MESSAGES.DOES_NOT_BELONG_TO_ORG);
    }

    if (dto.name && dto.name !== department.name) {
      const existing = await this.repo.findOne({
        where: { name: dto.name, tenant_id },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(DEPARTMENT_MESSAGES.NAME_ALREADY_EXISTS_FOR_TENANT(dto.name));
      }
    }

    if (dto.description !== undefined) {
      department.description = dto.description === '' || dto.description === null ? null : dto.description;
    }

    if (dto.name !== undefined) {
      department.name = dto.name;
    }

    try {
      return await this.repo.save(department);
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException(DEPARTMENT_MESSAGES.NAME_UNIQUE_WITHIN_COMPANY);
      }
      throw err;
    }
  }

  async findAll(tenant_id: string | null): Promise<Department[]> {
    this.requireTenantId(tenant_id);
    return this.repo
      .createQueryBuilder('dept')
      .where('dept.tenant_id IN (:...tenants)', { tenants: [GLOBAL_SYSTEM_TENANT_ID, tenant_id] })
      .orderBy('dept.name', 'ASC')
      .getMany();
  }

  async findOne(tenant_id: string | null, id: string): Promise<Department> {
    this.requireTenantId(tenant_id);
    const dept = await this.repo.findOne({ where: { id } });

    if (!dept) {
      throw new NotFoundException(DEPARTMENT_MESSAGES.NOT_FOUND);
    }

    if (dept.tenant_id === GLOBAL_SYSTEM_TENANT_ID && dept.tenant_id !== tenant_id) {
      throw new BadRequestException(DEPARTMENT_MESSAGES.GLOBAL_VIEW_ONLY_REFERENCE);
    }

    if (dept.tenant_id !== GLOBAL_SYSTEM_TENANT_ID && dept.tenant_id !== tenant_id) {
      throw new BadRequestException(DEPARTMENT_MESSAGES.DOES_NOT_BELONG_TO_ORG);
    }

    return dept;
  }

  async remove(tenant_id: string | null, id: string): Promise<DepartmentRemoveResult> {
    this.requireTenantId(tenant_id);
    const dept = await this.repo.findOne({
      where: { id },
      relations: ['designations'],
    });

    if (!dept) {
      throw new NotFoundException(DEPARTMENT_MESSAGES.NOT_FOUND);
    }

    if (dept.tenant_id === GLOBAL_SYSTEM_TENANT_ID) {
      throw new BadRequestException(DEPARTMENT_MESSAGES.GLOBAL_CANNOT_DELETE);
    }

    if (dept.tenant_id !== tenant_id) {
      throw new BadRequestException(DEPARTMENT_MESSAGES.DOES_NOT_BELONG_TO_ORG);
    }

    if (dept.designations?.length) {
      throw new BadRequestException(DEPARTMENT_MESSAGES.HAS_DESIGNATIONS(dept.name, dept.designations.length));
    }

    try {
      await this.repo.delete({ id, tenant_id });
      return { deleted: true, id };
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23503') {
        throw new BadRequestException(DEPARTMENT_MESSAGES.DELETE_BLOCKED_BY_FK);
      }
      throw err;
    }
  }

  /**
   * All departments across tenants (system admin). Uses two queries instead of N+1 per tenant.
   */
  async getAllDepartmentsAcrossTenants(tenantId?: string): Promise<AllDepartmentsAcrossTenantsResult> {
    const tenantWhere: FindOptionsWhere<Tenant> = { deleted_at: IsNull() };
    if (tenantId) {
      tenantWhere.id = tenantId;
    }

    const tenants = await this.tenantRepo.find({
      where: tenantWhere,
      order: { name: 'ASC' },
    });

    if (tenants.length === 0) {
      return { tenants: [] };
    }

    const tenantIds = tenants.map((t) => t.id);
    const allDepartments = await this.repo.find({
      where: { tenant_id: In(tenantIds) },
      order: { name: 'ASC' },
    });

    const byTenantId = new Map<string, Department[]>();
    for (const d of allDepartments) {
      const list = byTenantId.get(d.tenant_id) ?? [];
      list.push(d);
      byTenantId.set(d.tenant_id, list);
    }

    const result = tenants.map((tenant) => ({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      tenant_status: tenant.status,
      departments: (byTenantId.get(tenant.id) ?? []).map((dept) => ({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        created_at: dept.created_at,
      })),
    }));

    return { tenants: result };
  }
}
