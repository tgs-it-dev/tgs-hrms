import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PaginationService } from '../../common/services/pagination.service';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    private paginationService: PaginationService,
  ) {}

  async findAll(page: number = 1, size: number = 25) {
    return this.paginationService.paginate(
      this.permissionRepo,
      page,
      size,
      {},
      { created_at: 'DESC' }
    );
  }

  async findOne(id: string) {
    const permission = await this.permissionRepo.findOne({ where: { id } });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async create(dto: CreatePermissionDto) {
    const permission = this.permissionRepo.create(dto);
    return this.permissionRepo.save(permission);
  }

  async update(id: string, dto: UpdatePermissionDto) {
    const permission = await this.findOne(id);
    Object.assign(permission, dto);
    return this.permissionRepo.save(permission);
  }

  async remove(id: string) {
    const permission = await this.findOne(id);
    await this.permissionRepo.remove(permission);
    return { deleted: true, id };
  }
}
