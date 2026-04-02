import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere } from 'typeorm';
import { Designation } from '../../entities/designation.entity';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';
import { getPostgresErrorCode } from '../../common/types/database.types';
import { GLOBAL_SYSTEM_TENANT_ID } from '../../common/constants/enums';
import { DESIGNATION_LIST_PAGE_SIZE, DESIGNATION_MESSAGES } from '../../common/constants/designation.constants';
import type {
  AllDesignationsAcrossTenantsResult,
  DepartmentDesignationsGroup,
  DesignationRemoveResult,
} from './interfaces';

@Injectable()
export class DesignationService {
  constructor(
    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,

    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async create(tenant_id: string, dto: CreateDesignationDto): Promise<Designation> {
    const department = await this.departmentRepo.findOne({
      where: { id: dto.department_id },
    });

    if (!department) {
      throw new BadRequestException(DESIGNATION_MESSAGES.DEPARTMENT_NOT_FOUND);
    }

    if (department.tenant_id !== tenant_id && department.tenant_id !== GLOBAL_SYSTEM_TENANT_ID) {
      throw new BadRequestException(DESIGNATION_MESSAGES.DEPARTMENT_NOT_IN_ORG);
    }

    const existing = await this.designationRepo.findOne({
      where: {
        title: dto.title,
        department_id: dto.department_id,
      },
    });

    if (existing) {
      throw new ConflictException(DESIGNATION_MESSAGES.TITLE_EXISTS_IN_DEPARTMENT);
    }

    try {
      const designation = this.designationRepo.create({
        title: dto.title,
        department_id: dto.department_id,
        tenant_id,
      });
      return await this.designationRepo.save(designation);
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException(DESIGNATION_MESSAGES.TITLE_UNIQUE_IN_DEPARTMENT);
      }
      if (errorCode === '23502') {
        throw new BadRequestException(DESIGNATION_MESSAGES.MISSING_REQUIRED_FIELDS);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateDesignationDto): Promise<Designation> {
    const designation = await this.designationRepo.findOne({
      where: { id },
      relations: ['department'],
    });

    if (!designation) {
      throw new NotFoundException(DESIGNATION_MESSAGES.NOT_FOUND_DOT);
    }

    if (designation.tenant_id === GLOBAL_SYSTEM_TENANT_ID) {
      throw new BadRequestException(DESIGNATION_MESSAGES.GLOBAL_READ_ONLY_MODIFY);
    }

    const targetDepartmentId = dto.department_id ?? designation.department_id;

    if (dto.department_id !== undefined && dto.department_id !== designation.department_id) {
      const department = await this.departmentRepo.findOne({
        where: { id: dto.department_id },
      });
      if (!department) {
        throw new BadRequestException(DESIGNATION_MESSAGES.DEPARTMENT_NOT_FOUND);
      }
      if (department.tenant_id !== designation.tenant_id && department.tenant_id !== GLOBAL_SYSTEM_TENANT_ID) {
        throw new BadRequestException(DESIGNATION_MESSAGES.DEPARTMENT_NOT_IN_ORG);
      }
    }

    if (dto.title !== undefined && dto.title !== designation.title) {
      const exists = await this.designationRepo.findOne({
        where: {
          title: dto.title,
          department_id: targetDepartmentId,
        },
      });

      if (exists && exists.id !== id) {
        throw new ConflictException(DESIGNATION_MESSAGES.TITLE_ALREADY_IN_DEPARTMENT(dto.title));
      }
    }

    if (dto.title !== undefined) {
      designation.title = dto.title;
    }
    if (dto.department_id !== undefined) {
      designation.department_id = dto.department_id;
    }

    try {
      return await this.designationRepo.save(designation);
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException(DESIGNATION_MESSAGES.TITLE_UNIQUE_IN_DEPARTMENT);
      }
      throw err;
    }
  }

  async findAllByDepartment(department_id: string, page: number = 1): Promise<PaginationResponse<Designation>> {
    const limit = DESIGNATION_LIST_PAGE_SIZE;
    const skip = (page - 1) * limit;
    const [items, total] = await this.designationRepo.findAndCount({
      where: { department_id },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
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

  async findOne(id: string): Promise<Designation> {
    const designation = await this.designationRepo.findOne({
      where: { id },
      relations: ['department'],
    });
    if (!designation) {
      throw new NotFoundException(DESIGNATION_MESSAGES.NOT_FOUND_DOT);
    }
    return designation;
  }

  async remove(id: string): Promise<DesignationRemoveResult> {
    const designation = await this.designationRepo.findOne({
      where: { id },
      relations: ['department', 'employees'],
    });

    if (!designation) {
      throw new NotFoundException(DESIGNATION_MESSAGES.NOT_FOUND_DOT);
    }

    if (designation.tenant_id === GLOBAL_SYSTEM_TENANT_ID) {
      throw new BadRequestException(DESIGNATION_MESSAGES.GLOBAL_READ_ONLY_DELETE);
    }

    if (designation.employees?.length) {
      throw new BadRequestException(
        DESIGNATION_MESSAGES.HAS_EMPLOYEES(designation.title, designation.employees.length),
      );
    }

    try {
      await this.designationRepo.delete(id);
      return { deleted: true, id };
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23503') {
        throw new BadRequestException(DESIGNATION_MESSAGES.DELETE_BLOCKED_BY_FK);
      }
      throw err;
    }
  }

  /**
   * System-admin: all designations across tenants. One query for designations (no N+1 per tenant).
   */
  async getAllDesignationsAcrossTenants(tenantId?: string): Promise<AllDesignationsAcrossTenantsResult> {
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

    const designations = await this.designationRepo
      .createQueryBuilder('designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('designation.tenant_id IN (:...ids)', { ids: tenantIds })
      .orderBy('department.name', 'ASC')
      .addOrderBy('designation.title', 'ASC')
      .getMany();

    const byTenantId = new Map<string, Designation[]>();
    for (const d of designations) {
      const list = byTenantId.get(d.tenant_id) ?? [];
      list.push(d);
      byTenantId.set(d.tenant_id, list);
    }

    const result = tenants.map((tenant) => {
      const tenantDesignations = byTenantId.get(tenant.id) ?? [];
      const departmentMap = new Map<string, DepartmentDesignationsGroup>();

      for (const desg of tenantDesignations) {
        const deptId = desg.department_id;
        const deptName = desg.department?.name ?? '';

        if (!departmentMap.has(deptId)) {
          departmentMap.set(deptId, {
            department_id: deptId,
            department_name: deptName,
            designations: [],
          });
        }

        departmentMap.get(deptId)!.designations.push({
          id: desg.id,
          title: desg.title,
          created_at: desg.created_at,
        });
      }

      return {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_status: tenant.status,
        departments: Array.from(departmentMap.values()),
      };
    });

    return { tenants: result };
  }
}
