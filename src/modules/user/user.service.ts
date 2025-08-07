
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
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

  async create(createUserDto: CreateUserDto, tenantId: string) {
    
    const role = await this.roleRepo.findOne({
      where: { id: createUserDto.role_id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    
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

  findAll(tenantId: string) {
    return this.userRepo.find({
      where: { tenant_id: tenantId },
      relations: ['role'],
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.userRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['role'],
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, tenantId: string) {
    const user = await this.findOne(id, tenantId);
    Object.assign(user, updateUserDto);
    return this.userRepo.save(user);
  }

  async remove(id: string, tenantId: string) {
    const user = await this.findOne(id, tenantId);
    return this.userRepo.remove(user);
  }
}
