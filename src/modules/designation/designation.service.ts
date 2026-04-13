import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere, EntityManager } from 'typeorm';
import { Designation } from '../../entities/designation.entity';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';
import { getPostgresErrorCode } from '../../common/types/database.types';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

const GLOBAL = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class DesignationService {
  constructor(
    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,

    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    private readonly tenantDbService: TenantDatabaseService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return tenant?.schema_provisioned ?? false;
  }

  private async run<T>(
    tenantId: string,
    isProvisioned: boolean,
    work: (
      desgRepo: Repository<Designation>,
      deptRepo: Repository<Department>,
      em: EntityManager | null,
    ) => Promise<T>,
  ): Promise<T> {
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        work(
          em.getRepository(Designation),
          em.getRepository(Department),
          em,
        ),
      );
    }
    return work(this.designationRepo, this.departmentRepo, null);
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(tenant_id: string, dto: CreateDesignationDto): Promise<Designation> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    return this.run(tenant_id, isProvisioned, async (desgRepo, deptRepo) => {
      // For provisioned tenants the tenant schema holds both tenant-owned and
      // GLOBAL departments (copied during provisioning).  If the lookup misses
      // (e.g. a freshly added GLOBAL dept not yet in the tenant schema), fall
      // back to the public repo so the user still gets a meaningful error.
      let department = await deptRepo.findOne({ where: { id: dto.department_id } });

      if (!department && isProvisioned) {
        department = await this.departmentRepo.findOne({
          where: { id: dto.department_id },
        });
      }

      if (!department) {
        throw new BadRequestException(
          'Department not found. Please select a valid department.',
        );
      }

      if (
        !isProvisioned &&
        department.tenant_id !== tenant_id &&
        department.tenant_id !== GLOBAL
      ) {
        throw new BadRequestException(
          'Department does not belong to your organization',
        );
      }

      const existing = await desgRepo.findOne({
        where: { title: dto.title, department_id: dto.department_id },
      });

      if (existing) {
        throw new ConflictException(
          'Designation with this title already exists in this department',
        );
      }

      try {
        const designation = desgRepo.create({ ...dto, tenant_id });
        return await desgRepo.save(designation);
      } catch (err) {
        const errorCode = getPostgresErrorCode(err);
        if (errorCode === '23505') {
          throw new ConflictException('Title must be unique within the department');
        }
        if (errorCode === '23502') {
          throw new BadRequestException('Missing required fields');
        }
        throw err;
      }
    });
  }

  async update(
    tenant_id: string,
    id: string,
    dto: UpdateDesignationDto,
  ): Promise<Designation> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    return this.run(tenant_id, isProvisioned, async (desgRepo) => {
      const designation = await desgRepo.findOne({
        where: { id },
        relations: ['department'],
      });

      if (!designation) {
        throw new NotFoundException('Designation not found.');
      }

      if (!isProvisioned && designation.tenant_id === GLOBAL) {
        throw new BadRequestException(
          'Global designations are read-only reference templates and cannot be modified.',
        );
      }

      if (dto.title && dto.title !== designation.title) {
        const exists = await desgRepo.findOne({
          where: { title: dto.title, department_id: designation.department_id },
        });

        if (exists && exists.id !== id) {
          throw new ConflictException(
            `Title '${dto.title}' already exists in this department.`,
          );
        }
      }

      Object.assign(designation, dto);

      try {
        return await desgRepo.save(designation);
      } catch (err) {
        const errorCode = getPostgresErrorCode(err);
        if (errorCode === '23505') {
          throw new ConflictException('Title must be unique within the department');
        }
        throw err;
      }
    });
  }

  async findAllByDepartment(
    tenant_id: string,
    department_id: string,
    page: number = 1,
  ): Promise<PaginationResponse<Designation>> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);
    const limit = 25;
    const skip = (page - 1) * limit;

    if (isProvisioned) {
      // Union: tenant-schema designations for this department  +  any GLOBAL
      // designations that live only in the public schema (not yet copied).
      const [tenantDesgs, globalDesgs] = await Promise.all([
        this.tenantDbService.withTenantSchemaReadOnly(tenant_id, (em) =>
          em.getRepository(Designation).find({
            where: { department_id },
            order: { created_at: 'DESC' },
          }),
        ),
        this.designationRepo.find({
          where: { department_id, tenant_id: GLOBAL },
          order: { created_at: 'DESC' },
        }),
      ]);

      // Deduplicate (GLOBAL rows may already be in tenant schema after upgrade)
      const seen = new Set<string>();
      const all = [...tenantDesgs, ...globalDesgs]
        .filter((d) => {
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          return true;
        })
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      const total = all.length;
      const items = all.slice(skip, skip + limit);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    return this.run(tenant_id, isProvisioned, async (desgRepo) => {
      const [items, total] = await desgRepo.findAndCount({
        where: { department_id },
        order: { created_at: 'DESC' },
        skip,
        take: limit,
      });
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    });
  }

  async findOne(tenant_id: string, id: string): Promise<Designation> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    return this.run(tenant_id, isProvisioned, async (desgRepo) => {
      const designation = await desgRepo.findOne({
        where: { id },
        relations: ['department'],
      });
      if (!designation) {
        throw new NotFoundException('Designation not found.');
      }
      return designation;
    });
  }

  async remove(tenant_id: string, id: string): Promise<{ deleted: true; id: string }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    return this.run(tenant_id, isProvisioned, async (desgRepo) => {
      const designation = await desgRepo.findOne({
        where: { id },
        relations: ['department', 'employees'],
      });

      if (!designation) {
        throw new NotFoundException('Designation not found.');
      }

      if (!isProvisioned && designation.tenant_id === GLOBAL) {
        throw new BadRequestException(
          'Global designations are read-only reference templates and cannot be deleted.',
        );
      }

      if (designation.employees && designation.employees.length > 0) {
        throw new BadRequestException(
          `Cannot delete designation "${designation.title}" because it has ${designation.employees.length} employee(s) assigned. Please reassign employees to other designations first.`,
        );
      }

      try {
        await desgRepo.delete(id);
        return { deleted: true, id };
      } catch (err) {
        const errorCode = getPostgresErrorCode(err);
        if (errorCode === '23503') {
          throw new BadRequestException(
            'Cannot delete designation because it is still being referenced by employees. Please reassign employees to other designations first.',
          );
        }
        throw err;
      }
    });
  }

  /**
   * Get all designations across all tenants (for system admin).
   * Schema-provisioned tenants are queried via their dedicated schema.
   */
  async getAllDesignationsAcrossTenants(tenantId?: string): Promise<{
    tenants: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_status: string;
      departments: Array<{
        department_id: string;
        department_name: string;
        designations: Array<{ id: string; title: string; created_at: Date }>;
      }>;
    }>;
  }> {
    const tenantWhere: FindOptionsWhere<Tenant> = { deleted_at: IsNull() };
    if (tenantId) {
      tenantWhere.id = tenantId;
    }

    const tenants = await this.tenantRepo.find({
      where: tenantWhere,
      order: { name: 'ASC' },
    });

    const result: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_status: string;
      departments: Array<{
        department_id: string;
        department_name: string;
        designations: Array<{ id: string; title: string; created_at: Date }>;
      }>;
    }> = [];

    for (const tenant of tenants) {
      let designations: Designation[];

      if (tenant.schema_provisioned) {
        designations = await this.tenantDbService.withTenantSchemaReadOnly(
          tenant.id,
          (em) =>
            em
              .getRepository(Designation)
              .createQueryBuilder('designation')
              .leftJoinAndSelect('designation.department', 'department')
              .where('designation.tenant_id = :tid', { tid: tenant.id })
              .orderBy('department.name', 'ASC')
              .addOrderBy('designation.title', 'ASC')
              .getMany(),
        );
      } else {
        designations = await this.designationRepo
          .createQueryBuilder('designation')
          .leftJoinAndSelect('designation.department', 'department')
          .where('designation.tenant_id IN (:...tenantIds)', {
            tenantIds: [tenant.id, GLOBAL],
          })
          .orderBy('department.name', 'ASC')
          .addOrderBy('designation.title', 'ASC')
          .getMany();
      }

      const departmentMap = new Map<
        string,
        {
          department_id: string;
          department_name: string;
          designations: Array<{ id: string; title: string; created_at: Date }>;
        }
      >();

      for (const desg of designations) {
        const deptId = desg.department_id;
        const deptName = desg.department?.name || '';

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

      result.push({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_status: tenant.status,
        departments: Array.from(departmentMap.values()),
      });
    }

    return { tenants: result };
  }
}
