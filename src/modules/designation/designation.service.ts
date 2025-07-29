import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Designation } from '../../entities/designation.entity';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';


@Injectable()
export class DesignationService {
  constructor(
    @InjectRepository(Designation)
    private repo: Repository<Designation>,
  ) {}

  async create(tenantId: string, dto: CreateDesignationDto) {
    
    const existing = await this.repo.findOne({
      where: {
        title: dto.title,
        departmentId: dto.departmentId,
        tenantId: tenantId,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Designation with this title already exists in this department',
      );
    }

    try {
      const designation = this.repo.create({ ...dto, tenantId });
      return await this.repo.save(designation);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException(
          'Title must be unique within the department',
        );
      }
      if (err instanceof QueryFailedError && (err as any).code === '23502') {
        throw new BadRequestException('Missing required fields');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateDesignationDto) {
    const designation = await this.repo.findOneBy({ id });

    if (!designation) {
      throw new NotFoundException('Designation not found.');
    }

    
    if (dto.title && dto.title !== designation.title) {
      const exists = await this.repo.findOne({
        where: {
          title: dto.title,
          departmentId: designation.departmentId,
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
      return await this.repo.save(designation);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException(
          'Title must be unique within the department',
        );
      }
      throw err;
    }
  }

  async findAllByDepartment(departmentId: string) {
    return await this.repo.find({
      where: { departmentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const designation = await this.repo.findOneBy({ id });
    if (!designation) throw new NotFoundException('Designation not found.');
    return designation;
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    await this.findOne(id); 
    await this.repo.delete(id);
    return { deleted: true, id };
  }
}
