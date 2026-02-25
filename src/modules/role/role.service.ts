import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../../entities/role.entity';
import { ROLE_ERRORS } from './constants/role.constants';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

export interface RoleListItem {
  name: string;
}

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  /**
   * Get all roles as list items (name only) for listing API.
   */
  async findAll(): Promise<RoleListItem[]> {
    const roles = await this.roleRepository.find({
      select: ['name'],
      order: { name: 'ASC' },
    });
    return roles.map((role) => ({ name: role.name }));
  }

  /**
   * Find a role by ID (full entity). Throws if not found.
   */
  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(ROLE_ERRORS.NOT_FOUND(id));
    }
    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const role = this.roleRepository.create(dto);
    return this.roleRepository.save(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    Object.assign(role, dto);
    return this.roleRepository.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    await this.roleRepository.remove(role);
  }
}
