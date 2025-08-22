import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginationService } from '../../common/services/pagination.service';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private paginationService: PaginationService,
  ) {}

  async findAll(page: number = 1, size: number = 25) {
    return this.paginationService.paginate(
      this.roleRepo,
      page,
      size,
      {},
      { created_at: 'DESC' }
    );
  }

  async findOne(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async create(dto: CreateRoleDto) {
    const role = this.roleRepo.create(dto);
    return this.roleRepo.save(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id);
    Object.assign(role, dto);
    return this.roleRepo.save(role);
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    await this.roleRepo.remove(role);
    return { deleted: true, id };
  }
}
