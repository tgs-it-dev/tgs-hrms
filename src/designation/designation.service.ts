import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, QueryFailedError } from 'typeorm';
import { Designation } from 'src/entities/designation.entity';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';

@Injectable()
export class DesignationService {
  constructor(
    @InjectRepository(Designation)
    private repo: Repository<Designation>,
  ) {}

  async create(dto: CreateDesignationDto) {
    const exists = await this.repo.findOne({
      where: {
        departmentId: dto.departmentId,
        title: dto.title,
      },
    });

    if (exists) {
      throw new ConflictException(
        `Designation '${dto.title}' already exists in this department.`,
      );
    }

    try {
      return await this.repo.save(this.repo.create(dto));
    } catch (err) {
      if (err.code === '23505') {
        throw new ConflictException('Designation must be unique per department.');
      }
      if (err instanceof QueryFailedError && (err as any).code === '23502') {
        throw new BadRequestException('Title is required.');
      }
      throw err;
    }
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException('Designation not found.');
    return item;
  }

  async update(id: string, dto: UpdateDesignationDto) {
    const existing = await this.repo.findOneBy({ id });
    if (!existing) throw new NotFoundException('Designation not found.');

    if (dto.title && dto.title !== existing.title) {
      const duplicate = await this.repo.findOne({
        where: {
          departmentId: existing.departmentId,
          title: dto.title,
          id: Not(id),
        },
      });
      if (duplicate) {
        throw new ConflictException(`Another designation '${dto.title}' already exists.`);
      }
    }

    Object.assign(existing, dto);
    try {
      return await this.repo.save(existing);
    } catch (err) {
      if (err.code === '23505') {
        throw new ConflictException('Designation title must be unique in department.');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const found = await this.findOne(id);
    await this.repo.delete({ id });
    return { deleted: true, id };
  }
}