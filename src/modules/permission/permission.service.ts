import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
  ) {}

  async findAll(): Promise<Permission[]> {
    return this.permissionRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Permission> {
    const permission = await this.permissionRepo.findOne({ where: { id } });
    if (!permission) {
      throw new NotFoundException(`Permission with ID '${id}' not found`);
    }
    return permission;
  }

  async create(dto: CreatePermissionDto): Promise<Permission> {
    const existing = await this.permissionRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Permission '${dto.name}' already exists`,
      );
    }
    const permission = this.permissionRepo.create(dto);
    return this.permissionRepo.save(permission);
  }

  async update(id: string, dto: UpdatePermissionDto): Promise<Permission> {
    const permission = await this.findOne(id);

    if (dto.name && dto.name !== permission.name) {
      const nameConflict = await this.permissionRepo.findOne({
        where: { name: dto.name },
      });
      if (nameConflict) {
        throw new ConflictException(
          `Permission '${dto.name}' already exists`,
        );
      }
    }

    Object.assign(permission, dto);
    return this.permissionRepo.save(permission);
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id); // throws NotFoundException if missing

    const usageCount = await this.rolePermissionRepo.count({
      where: { permission_id: id },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Cannot delete permission: it is assigned to ${usageCount} role(s). Remove it from all roles first.`,
      );
    }

    await this.permissionRepo.delete(id);
    return { message: 'Permission deleted successfully' };
  }
}
