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

  async create(tenantId: string, dto: CreateDepartmentDto) {
    
    const existing = await this.repo.findOne({
      where: { name: dto.name, tenantId },
    });

    if (existing) {
      throw new ConflictException(
        `Department '${dto.name}' already exists in your company.`,
      );
    }

    try {
      const department = this.repo.create({
        ...dto,
        tenantId,
        tenant: { id: tenantId } as any, 
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

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    const department = await this.repo.findOneBy({ id, tenantId });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    
    if (dto.name && dto.name !== department.name) {
      const existing = await this.repo.findOne({
        where: { name: dto.name, tenantId },
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

  async findAll(tenantId: string) {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const dept = await this.repo.findOne({ where: { id, tenantId } });

    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    return dept;
  }

  async remove(
    tenantId: string,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    await this.findOne(tenantId, id); 
    await this.repo.delete({ id, tenantId });
    return { deleted: true, id };
  }
}
