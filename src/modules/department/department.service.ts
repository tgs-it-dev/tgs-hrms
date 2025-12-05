import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
const GLOBAL = '00000000-0000-0000-0000-000000000000';
@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private repo: Repository<Department>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>
  ) {}

  async create(tenant_id: string, dto: CreateDepartmentDto) {
    const existing = await this.repo.findOne({
      where: { name: dto.name, tenant_id },
    });

    if (existing) {
      throw new ConflictException(`Department '${dto.name}' already exists in your company.`);
    }

    try {
      const department = this.repo.create({
        name: dto.name,
        description: dto.description || null, 
        tenant_id,
        tenant: { id: tenant_id } as any, 
      });

      return await this.repo.save(department);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Department name must be unique within your company');
      }
      if (err instanceof QueryFailedError && (err as any).code === '23502') {
        throw new BadRequestException('Department name is required.');
      }
      throw err;
    }
  }

  async update(tenant_id: string, id: string, dto: UpdateDepartmentDto) {
    const department = await this.repo.findOne({ where: { id } });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

  
    if (department.tenant_id === GLOBAL) {
      throw new BadRequestException('Global departments cannot be modified. They are provided as reference templates for your organization.');
    }

  
    if (department.tenant_id !== tenant_id) {
      throw new BadRequestException('Department does not belong to your organization');
    }

    if (dto.name && dto.name !== department.name) {
      const existing = await this.repo.findOne({
        where: { name: dto.name, tenant_id },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Department name '${dto.name}' already exists for this tenant.`
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
      return await this.repo.save(department);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Department name must be unique within your company');
      }
      throw err;
    }
  }

  
  async findAll(tenant_id: string) {
    return this.repo.createQueryBuilder('dept')
      .where('dept.tenant_id IN (:...tenants)', { tenants: [GLOBAL, tenant_id] })
      .orderBy('dept.name', 'ASC')
      .getMany();
  }


  async findOne(tenant_id: string, id: string) {
    const dept = await this.repo.findOne({ where: { id } });

    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    
    if (dept.tenant_id === GLOBAL && dept.tenant_id !== tenant_id) {
      throw new BadRequestException('This is a global department and cannot be modified. You can only view it as a reference.');
    }


    if (dept.tenant_id !== GLOBAL && dept.tenant_id !== tenant_id) {
      throw new BadRequestException('Department does not belong to your organization');
    }

    return dept;
  }

  async remove(tenant_id: string, id: string): Promise<{ deleted: true; id: string }> {
    const dept = await this.repo.findOne({ 
      where: { id }, 
      relations: ['designations'] 
    });

    if (!dept) {
      throw new NotFoundException('Department not found');
    }

  
    if (dept.tenant_id === GLOBAL) {
      throw new BadRequestException('Global departments cannot be deleted. They are provided as reference templates for your organization.');
    }

  
    if (dept.tenant_id !== tenant_id) {
      throw new BadRequestException('Department does not belong to your organization');
    }

    
    if (dept.designations && dept.designations.length > 0) {
      throw new BadRequestException(
        `Cannot delete department "${dept.name}" because it contains ${dept.designations.length} designation(s). Please delete all designations first, or reassign employees to other designations.`
      );
    }

    try {
      await this.repo.delete({ id, tenant_id });
      return { deleted: true, id };
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const code = (err as any).code;
        if (code === '23503') { 
          throw new BadRequestException(
            'Cannot delete department because it is still being referenced by other records. Please check for any remaining designations or employees.'
          );
        }
      }
      throw err;
    }
  }

  /**
   * Get all departments across all tenants (for system admin)
   * @param tenantId - Optional tenant ID to filter by
   * @returns Departments grouped by tenant
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
    // Get tenants (filter by tenantId if provided)
    const tenantWhere: any = { isDeleted: false };
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
      // Get all departments for this tenant
      const departments = await this.repo.find({
        where: { tenant_id: tenant.id },
        order: { name: 'ASC' },
      });

      // Transform departments data
      const transformedDepartments = departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        created_at: dept.created_at,
      }));

      result.push({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_status: tenant.status,
        departments: transformedDepartments,
      });
    }

    return { tenants: result };
  }
}
