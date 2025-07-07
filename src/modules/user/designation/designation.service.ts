import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from 'src/entities/designation.entity';
import { Department } from 'src/entities/department.entity';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
@Injectable()
export class DesignationService {
  constructor(
    @InjectRepository(Designation)
    private readonly repo: Repository<Designation>,
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
  ) {}

  /* ────────── CREATE ────────── */
  async create(tenantId: string, dto: CreateDesignationDto) {
    const department = await this.deptRepo.findOneBy({ id: dto.departmentId, tenantId });
    if (!department) throw new BadRequestException('Invalid department for this tenant.');

    try {
      return await this.repo.save(
        this.repo.create({
          ...dto,
          tenantId,
          tenant: { id: tenantId },
          department,
        }),
      );
    } catch (err: any) {
      if (err.code === '23505')
        throw new ConflictException('Designation title already exists in this department.');
      /* NOT‑NULL violations (e.g., missing title) */
      if (err.code === '23502')
        throw new BadRequestException('Title is required.');

      /* invalid UUID syntax (deptId or id) */
      if (err.code === '22P02')
        throw new BadRequestException('Invalid UUID format.');
      throw err;
    }
  }

  /* ────────── LIST BY DEPT ────────── */
  findAll(tenantId: string, departmentId: string) {
    return this.repo.find({
      where: { tenantId, departmentId },
      order: { createdAt: 'DESC' },
    });
  }

  /* ────────── GET ONE ────────── */
  async findOne(tenantId: string, id: string) {
    const desig = await this.repo.findOne({ where: { id, tenantId } });
    if (!desig) throw new NotFoundException('Designation not found');
    return desig;
  }

  /* ────────── UPDATE ────────── */
  async update(tenantId: string, id: string, dto: UpdateDesignationDto) {
    const desig = await this.findOne(tenantId, id);

    if (dto.departmentId && dto.departmentId !== desig.departmentId) {
      const dept = await this.deptRepo.findOneBy({ id: dto.departmentId, tenantId });
      if (!dept) throw new BadRequestException('Invalid department for this tenant.');
      desig.department = dept;
      desig.departmentId = dept.id;
    }

    Object.assign(desig, dto);

    try {
      return await this.repo.save(desig);
    } catch (err: any) {
      if (err.code === '23505')
        throw new ConflictException('Designation title already exists in this department.');
      throw err;
    }
  }

  /* ────────── DELETE ────────── */
  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);           // throws 404 if not found
    await this.repo.delete({ id, tenantId });
    return { deleted: true, id };
  }
}
