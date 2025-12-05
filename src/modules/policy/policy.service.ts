import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from '../../entities/policy.entity';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy)
    private readonly repo: Repository<Policy>
  ) {}

  async create(tenant_id: string, dto: CreatePolicyDto) {
    const exists = await this.repo.findOne({
      where: { tenant_id, title: dto.title, category: dto.category },
      withDeleted: true,
    });
    if (exists && !exists.deleted_at) {
      throw new ConflictException(
        `Policy '${dto.title}' in category '${dto.category}' already exists for this tenant.`
      );
    }

    const policy = this.repo.create({ ...dto, tenant_id, tenant: { id: tenant_id } as any });
    return await this.repo.save(policy);
  }

  async findAll(tenant_id: string, page = 1) {
    const limit = 25;
    const skip = (page - 1) * limit;
    const [items, total] = await this.repo.findAndCount({
      where: { tenant_id },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });
    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenant_id: string, id: string) {
    const policy = await this.repo.findOne({ where: { id, tenant_id } });
    if (!policy) throw new NotFoundException('Policy not found.');
    return policy;
  }

  async update(tenant_id: string, id: string, dto: UpdatePolicyDto) {
    const policy = await this.findOne(tenant_id, id);

    if (dto.title || dto.category) {
      const nextTitle = dto.title ?? policy.title;
      const nextCategory = dto.category ?? policy.category;
      const conflict = await this.repo.findOne({
        where: { tenant_id, title: nextTitle, category: nextCategory },
      });
      if (conflict && conflict.id !== policy.id) {
        throw new ConflictException(
          `Another policy with title '${nextTitle}' and category '${nextCategory}' already exists.`
        );
      }
    }

    Object.assign(policy, dto);
    return await this.repo.save(policy);
  }

  async softDelete(tenant_id: string, id: string) {
    const policy = await this.findOne(tenant_id, id);
    await this.repo.softDelete({ id: policy.id, tenant_id });
    return { deleted: true, id };
  }
}
