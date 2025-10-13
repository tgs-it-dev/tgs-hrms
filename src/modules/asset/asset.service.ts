import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetStatus } from '../../common/constants/enums';

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
      status: AssetStatus.AVAILABLE,
      purchase_date: dto.purchaseDate ?? null,
      tenant_id: tenantId,
    });
    return await this.assetRepo.save(entity);
  }

  async findAll(tenantId: string, filters: { status?: string; category?: string }) {
    const qb = this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assignedToUser', 'assignedUser')
      .where('a.tenant_id = :tenantId', { tenantId });
    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });
    if (filters.category) qb.andWhere('a.category = :category', { category: filters.category });
    const assets = await qb.orderBy('a.created_at', 'DESC').getMany();
    return assets.map((a) => ({
      ...a,
      assignedToName: a.assignedToUser
        ? `${a.assignedToUser.first_name ?? ''} ${a.assignedToUser.last_name ?? ''}`.trim()
        : null,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const asset = await this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assignedToUser', 'assignedUser')
      .where('a.id = :id AND a.tenant_id = :tenantId', { id, tenantId })
      .getOne();
    if (!asset) throw new NotFoundException('Asset not found');
    return {
      ...asset,
      assignedToName: asset.assignedToUser
        ? `${asset.assignedToUser.first_name ?? ''} ${asset.assignedToUser.last_name ?? ''}`.trim()
        : null,
    };
  }

  async update(tenantId: string, id: string, dto: UpdateAssetDto) {
    const asset = await this.findOne(tenantId, id);
    Object.assign(asset, {
      name: dto.name ?? asset.name,
      category: dto.category ?? asset.category,
      status: (dto.status as AssetStatus) ?? asset.status,
      assigned_to: dto.assignedTo ?? asset.assigned_to,
    });
    return this.assetRepo.save(asset);
  }

  async softDelete(tenantId: string, id: string) {
    const asset = await this.findOne(tenantId, id);
    asset.status = AssetStatus.RETIRED;
    return this.assetRepo.save(asset);
  }
}