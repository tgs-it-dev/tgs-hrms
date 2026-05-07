import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere, EntityManager } from 'typeorm';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { getPostgresErrorCode } from '../../common/types/database.types';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

const GLOBAL = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private repo: Repository<Department>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    private readonly tenantDbService: TenantDatabaseService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return tenant?.schema_provisioned ?? false;
  }

  private getRepo(em: EntityManager | null): Repository<Department> {
    return em ? em.getRepository(Department) : this.repo;
  }

  private async run<T>(
    tenantId: string,
    isProvisioned: boolean,
    work: (repo: Repository<Department>, em: EntityManager | null) => Promise<T>,
  ): Promise<T> {
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        work(em.getRepository(Department), em),
      );
    }
    return work(this.repo, null);
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(tenant_id: string, dto: CreateDepartmentDto): Promise<Department> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    return this.run(tenant_id, isProvisioned, async (repo) => {
      const existing = await repo.findOne({
        where: { name: dto.name, tenant_id },
      });

      if (existing) {
        throw new ConflictException(`Department '${dto.name}' already exists in your company.`);
      }

      try {
        const department = repo.create({
          name: dto.name,
          description: dto.description || null,
          tenant_id,
        });
        return await repo.save(department);
      } catch (err) {
        const errorCode = getPostgresErrorCode(err);
        if (errorCode === '23505') {
          throw new ConflictException('Department name must be unique within your company');
        }
        if (errorCode === '23502') {
          throw new BadRequestException('Department name is required.');
        }
        throw err;
      }
    });
  }

  async update(tenant_id: string, id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    return this.run(tenant_id, isProvisioned, async (repo) => {
      const department = await repo.findOne({ where: { id } });

      if (!department) {
        throw new NotFoundException('Department not found.');
      }

      if (!isProvisioned && department.tenant_id === GLOBAL) {
        throw new BadRequestException(
          'Global departments cannot be modified. They are provided as reference templates for your organization.',
        );
      }

      if (department.tenant_id !== tenant_id) {
        throw new BadRequestException('Department does not belong to your organization');
      }

      if (dto.name && dto.name !== department.name) {
        const existing = await repo.findOne({
          where: { name: dto.name, tenant_id },
        });

        if (existing && existing.id !== id) {
          throw new ConflictException(
            `Department name '${dto.name}' already exists for this tenant.`,
          );
        }
      }

      if (dto.description !== undefined) {
        department.description =
          dto.description === '' || dto.description === null ? null : dto.description;
      }

      if (dto.name !== undefined) {
        department.name = dto.name;
      }

      try {
        return await repo.save(department);
      } catch (err) {
        const errorCode = getPostgresErrorCode(err);
        if (errorCode === '23505') {
          throw new ConflictException('Department name must be unique within your company');
        }
        throw err;
      }
    });
  }

  async findAll(tenant_id: string): Promise<Department[]> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    if (isProvisioned) {
      // Fetch tenant-specific departments from the tenant schema and GLOBAL
      // departments from the public schema, then merge.  GLOBAL platform data
      // stays in public; the tenant schema holds only tenant-owned rows.
      const [tenantDepts, globalDepts] = await Promise.all([
        this.tenantDbService.withTenantSchemaReadOnly(tenant_id, (em) =>
          em
            .getRepository(Department)
            .createQueryBuilder('dept')
            .where('dept.tenant_id = :tenant_id', { tenant_id })
            .orderBy('dept.name', 'ASC')
            .getMany(),
        ),
        this.repo.find({
          where: { tenant_id: GLOBAL },
          order: { name: 'ASC' },
        }),
      ]);

      // Deduplicate by id (GLOBAL rows may have been copied into tenant schema)
      // and sort alphabetically.
      const seen = new Set<string>();
      return [...globalDepts, ...tenantDepts]
        .filter((d) => {
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return this.repo
      .createQueryBuilder('dept')
      .where('dept.tenant_id IN (:...tenants)', { tenants: [GLOBAL, tenant_id] })
      .orderBy('dept.name', 'ASC')
      .getMany();
  }

  async findOne(tenant_id: string, id: string): Promise<Department> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    return this.run(tenant_id, isProvisioned, async (repo) => {
      const dept = await repo.findOne({ where: { id } });

      if (!dept) {
        throw new NotFoundException('Department not found');
      }

      if (!isProvisioned) {
        if (dept.tenant_id === GLOBAL && dept.tenant_id !== tenant_id) {
          throw new BadRequestException(
            'This is a global department and cannot be modified. You can only view it as a reference.',
          );
        }
        if (dept.tenant_id !== GLOBAL && dept.tenant_id !== tenant_id) {
          throw new BadRequestException('Department does not belong to your organization');
        }
      }

      return dept;
    });
  }

  async remove(tenant_id: string, id: string): Promise<{ deleted: true; id: string }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    return this.run(tenant_id, isProvisioned, async (repo) => {
      const dept = await repo.findOne({
        where: { id },
        relations: ['designations'],
      });

      if (!dept) {
        throw new NotFoundException('Department not found');
      }

      if (!isProvisioned && dept.tenant_id === GLOBAL) {
        throw new BadRequestException(
          'Global departments cannot be deleted. They are provided as reference templates for your organization.',
        );
      }

      if (dept.tenant_id !== tenant_id) {
        throw new BadRequestException('Department does not belong to your organization');
      }

      if (dept.designations && dept.designations.length > 0) {
        throw new BadRequestException(
          `Cannot delete department "${dept.name}" because it contains ${dept.designations.length} designation(s). Please delete all designations first, or reassign employees to other designations.`,
        );
      }

      try {
        await repo.delete({ id, tenant_id });
        return { deleted: true, id };
      } catch (err) {
        const errorCode = getPostgresErrorCode(err);
        if (errorCode === '23503') {
          throw new BadRequestException(
            'Cannot delete department because it is still being referenced by other records. Please check for any remaining designations or employees.',
          );
        }
        throw err;
      }
    });
  }

  /**
   * Get all departments across all tenants (for system admin).
   * Schema-provisioned tenants are queried via their dedicated schema.
   */
  async getAllDepartmentsAcrossTenants(tenantId?: string): Promise<{
    tenants: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_status: string;
      departments: Array<{
        id: string;
        name: string;
        description: string | null;
        created_at: Date;
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
        id: string;
        name: string;
        description: string | null;
        created_at: Date;
      }>;
    }> = [];

    for (const tenant of tenants) {
      let departments: Department[];

      if (tenant.schema_provisioned) {
        departments = await this.tenantDbService.withTenantSchemaReadOnly(
          tenant.id,
          (em) =>
            em
              .getRepository(Department)
              .createQueryBuilder('dept')
              .where('dept.tenant_id = :tid', { tid: tenant.id })
              .orderBy('dept.name', 'ASC')
              .getMany(),
        );
      } else {
        departments = await this.repo.find({
          where: [{ tenant_id: tenant.id }, { tenant_id: GLOBAL }],
          order: { name: 'ASC' },
        });
      }

      result.push({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_status: tenant.status,
        departments: departments.map((dept) => ({
          id: dept.id,
          name: dept.name,
          description: dept.description,
          created_at: dept.created_at,
        })),
      });
    }

    return { tenants: result };
  }
}
