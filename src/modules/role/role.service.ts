import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../entities/role.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<{ name: string }[]> {
    const roles = await this.roleRepository.find({
      select: ['name'],
    });
    return roles.map(role => ({ name: role.name }));
  }

  async findOne(id: string): Promise<{ name: string }> {
    const role = await this.roleRepository.findOne({
      where: { id },
      select: ['name'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return { name: role.name };
  }

  async create(createRoleDto: any): Promise<Role> {
    const role = this.roleRepository.create(createRoleDto);
    const savedRole = await this.roleRepository.save(role) as unknown as Role;
    return savedRole;
  }

  async update(id: string, updateRoleDto: any): Promise<Role> {
    const role = await this.findOne(id);
    Object.assign(role, updateRoleDto);
    const updatedRole = await this.roleRepository.save(role) as unknown as Role;
    return updatedRole;
  }

  async remove(id: string): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    await this.roleRepository.remove(role);
  }
}
