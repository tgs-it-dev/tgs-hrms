// src/modules/user/user.service.ts

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from 'src/entities/user.entity';
import { Role } from 'src/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  private async isSystemAdmin(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) throw new NotFoundException('Authenticated user not found');
    return user.role.name === 'system-admin';
  }

  async create(createUserDto: CreateUserDto, tenantId: string) {
    const role = await this.roleRepo.findOne({
      where: { id: createUserDto.role_id },
    });

    if (!role) throw new NotFoundException('Role not found');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepo.create({
      ...createUserDto,
      password: hashedPassword,
      tenant_id: tenantId,
      role_id: createUserDto.role_id,
      role,
    });

    return this.userRepo.save(user);
  }

  async findAll(requestedTenantId: string, currentUserId: string) {
    const isAdmin = !(await this.isSystemAdmin(currentUserId));

    return this.userRepo.find({
      where: {
        tenant_id: isAdmin ? requestedTenantId : undefined,
      },
      relations: ['role'],
    });
  }

  async findOne(userId: string, requestedTenantId: string, currentUserId: string) {
    const isAdmin = !(await this.isSystemAdmin(currentUserId));

    const user = await this.userRepo.findOne({
      where: {
        id: userId,
        tenant_id: isAdmin ? requestedTenantId : undefined,
      },
      relations: ['role'],
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(userId: string, dto: UpdateUserDto, tenantId: string, currentUserId: string) {
    const user = await this.findOne(userId, tenantId, currentUserId);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(userId: string, tenantId: string, currentUserId: string) {
    const user = await this.findOne(userId, tenantId, currentUserId);
    return this.userRepo.remove(user);
  }
}
