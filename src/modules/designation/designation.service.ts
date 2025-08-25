import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Designation } from '../../entities/designation.entity';
import { Department } from '../../entities/department.entity';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';

@Injectable()
export class DesignationService {
  constructor(
    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,

    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
  ) {}

  async create(tenant_id: string, dto: CreateDesignationDto) {
    const department = await this.departmentRepo.findOne({
      where: { id: dto.department_id, tenant_id },
    });

    if (!department) {
      throw new BadRequestException('Invalid department for this tenant');
    }

    const existing = await this.designationRepo.findOne({
      where: {
        title: dto.title,
        department_id: dto.department_id,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Designation with this title already exists in this department',
      );
    }

    try {
      const designation = this.designationRepo.create(dto);
      return await this.designationRepo.save(designation);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const code = (err as any).code;
        if (code === '23505') {
          throw new ConflictException('Title must be unique within the department');
        }
        if (code === '23502') {
          throw new BadRequestException('Missing required fields');
        }
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateDesignationDto) {
    const designation = await this.designationRepo.findOneBy({ id });

    if (!designation) {
      throw new NotFoundException('Designation not found.');
    }

    if (dto.title && dto.title !== designation.title) {
      const exists = await this.designationRepo.findOne({
        where: {
          title: dto.title,
          department_id: designation.department_id,
        },
      });

      if (exists && exists.id !== id) {
        throw new ConflictException(
          `Title '${dto.title}' already exists in this department.`,
        );
      }
    }

    Object.assign(designation, dto);

    try {
      return await this.designationRepo.save(designation);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Title must be unique within the department');
      }
      throw err;
    }
  }

  async findAllByDepartment(department_id: string, page: number = 1): Promise<PaginationResponse<Designation>> {
    const limit = 25;
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

  async findOne(id: string) {
    const designation = await this.designationRepo.findOneBy({ id });
    if (!designation) {
      throw new NotFoundException('Designation not found.');
    }
    return designation;
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    await this.findOne(id); // Ensure exists
    await this.designationRepo.delete(id);
    return { deleted: true, id };
  }
}
