import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Department } from '../../entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private repo: Repository<Department>,
  ) {}

  async create(tenant_id: string, dto: CreateDepartmentDto) {
    const existing = await this.repo.findOne({
      where: { name: dto.name, tenant_id },
    });

    if (existing) {
      throw new ConflictException(
        `Department '${dto.name}' already exists in your company.`,
      );
    }

    try {
      const department = this.repo.create({
        ...dto,
        tenant_id,
        tenant: { id: tenant_id } as any, // attach tenant relation
      });

      return await this.repo.save(department);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException(
          'Department name must be unique within your company',
        );
      }
      if (err instanceof QueryFailedError && (err as any).code === '23502') {
        throw new BadRequestException('Department name is required.');
      }
      throw err;
    }
  }

  async update(tenant_id: string, id: string, dto: UpdateDepartmentDto) {
    const department = await this.repo.findOneBy({ id, tenant_id });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    if (dto.name && dto.name !== department.name) {
      const existing = await this.repo.findOne({
        where: { name: dto.name, tenant_id },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Department name '${dto.name}' already exists for this tenant.`,
        );
      }
    }

    Object.assign(department, dto);

    try {
      return await this.repo.save(department);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException(
          'Department name must be unique within your company',
        );
      }
      throw err;
    }
  }

  async findAll(tenant_id: string) {
    return this.repo.find({
      where: { tenant_id },
      order: { created_at: 'DESC' },
    });
  }


  async findOne(tenant_id: string, id: string) {
    const dept = await this.repo.findOne({ where: { id, tenant_id } });

    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    return dept;
  }

  async remove(tenant_id: string, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOne(tenant_id, id);
    await this.repo.delete({ id, tenant_id });
    return { deleted: true, id };
  }
}
