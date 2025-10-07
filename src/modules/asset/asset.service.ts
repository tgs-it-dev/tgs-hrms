import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
  ) {}

  async create(dto: CreateAssetDto, tenantId: string) {
    const entity = this.assetRepo.create({
      name: dto.name,
      category: dto.category,
      status: 'available',
      purchase_date: dto.purchaseDate ?? null,
      tenant_id: tenantId,
    });
    return await this.assetRepo.save(entity);
  }

  async findAll(tenantId: string, filters: { status?: string; category?: string }) {
    const qb = this.assetRepo.createQueryBuilder('a').where('a.tenant_id = :tenantId', { tenantId });
    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });
    if (filters.category) qb.andWhere('a.category = :category', { category: filters.category });
    return qb.orderBy('a.created_at', 'DESC').getMany();
  }

  async findOne(tenantId: string, id: string) {
    const asset = await this.assetRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async update(tenantId: string, id: string, dto: UpdateAssetDto) {
    const asset = await this.findOne(tenantId, id);
    Object.assign(asset, {
      name: dto.name ?? asset.name,
      category: dto.category ?? asset.category,
      status: (dto.status as any) ?? asset.status,
      assigned_to: dto.assignedTo ?? asset.assigned_to,
    });
    return this.assetRepo.save(asset);
  }

  async softDelete(tenantId: string, id: string) {
    const asset = await this.findOne(tenantId, id);
    asset.status = 'retired';
    return this.assetRepo.save(asset);
  }
}


