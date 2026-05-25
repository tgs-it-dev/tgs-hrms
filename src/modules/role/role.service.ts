import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../entities/role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

// System roles that must not be deleted or renamed
const PROTECTED_ROLES = [
  'admin',
  'system-admin',
  'hr-admin',
  'employee',
  'manager',
];

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID '${id}' not found`);
    }
    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Role '${dto.name}' already exists`);
    }
    const role = this.roleRepo.create(dto);
    return this.roleRepo.save(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);

    if (dto.name && dto.name !== role.name) {
      if (PROTECTED_ROLES.includes(role.name)) {
        throw new BadRequestException(
          `System role '${role.name}' cannot be renamed`,
        );
      }
      const nameConflict = await this.roleRepo.findOne({
        where: { name: dto.name },
      });
      if (nameConflict) {
        throw new ConflictException(`Role '${dto.name}' already exists`);
      }
    }

    Object.assign(role, dto);
    return this.roleRepo.save(role);
  }

  async remove(id: string): Promise<{ message: string }> {
    const role = await this.findOne(id);

    if (PROTECTED_ROLES.includes(role.name)) {
      throw new BadRequestException(
        `System role '${role.name}' cannot be deleted`,
      );
    }

    const assignedCount = await this.rolePermissionRepo.count({
      where: { role_id: id },
    });
    if (assignedCount > 0) {
      throw new BadRequestException(
        `Cannot delete role: it has ${assignedCount} permission(s) assigned. Remove them first.`,
      );
    }

    await this.roleRepo.delete(id);
    return { message: `Role '${role.name}' deleted successfully` };
  }
}
