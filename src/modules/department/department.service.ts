// modules/department/department.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private repo: Repository<Department>
  ) {}

  async create(tenantId: string, dto: CreateDepartmentDto) {
    try {
      return await this.repo.save(this.repo.create({ ...dto, tenantId }));
    } catch (err) {
      if (err.code === '23505') { // Unique violation (Postgres)
        throw new BadRequestException('Department name must be unique within your company');
      }
      throw err;
    }
  }

  findAll(tenantId: string) {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string) {
    const dept = await this.repo.findOne({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findOne(tenantId, id);
    await this.repo.update({ id, tenantId }, dto);
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.repo.delete({ id, tenantId });
  }
}
