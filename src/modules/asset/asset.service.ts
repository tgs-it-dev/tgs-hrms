import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { AssetRequest } from '../../entities/asset-request.entity';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetStatus, AssetRequestStatus } from '../../common/constants/enums';

@Injectable()
export class AssetService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(AssetRequest)
    private readonly assetRequestRepo: Repository<AssetRequest>,
  ) {}

  async create(dto: CreateAssetDto, tenantId: string) {
    const entity = this.assetRepo.create({
      name: dto.name,
      category_id: dto.categoryId,
      subcategory_id: dto.subcategoryId ?? null,
      status: AssetStatus.AVAILABLE,
      purchase_date: dto.purchaseDate ?? null,
      tenant_id: tenantId,
    });
    return await this.assetRepo.save(entity);
  }

  async findAll(
    tenantId: string,
    filters: { status?: string; categoryId?: string; page?: number }
  ) {
    const { status, categoryId, page = 1 } = filters;
    const limit = 25;
    const skip = (page - 1) * limit;

    const qb = this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assignedToUser', 'assignedUser')
      .leftJoinAndSelect('a.category', 'category')
      .leftJoinAndSelect('a.subcategory', 'subcategory')
      .where('a.tenant_id = :tenantId', { tenantId });

    // Trim whitespace and make case-insensitive filtering
    if (status) {
      const trimmedStatus = status.trim().toLowerCase();
      qb.andWhere('LOWER(a.status) = :status', { status: trimmedStatus });
    }
    if (categoryId) {
      qb.andWhere('a.category_id = :categoryId', { categoryId });
    }

    const [items, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    // Get counts for all statuses in a single query
    const statusCounts = await this.assetRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('a.tenant_id = :tenantId', { tenantId })
      .groupBy('a.status')
      .getRawMany();

    // Initialize counts
    const counts = {
      total: 0,
      available: 0,
      assigned: 0,
      retired: 0,
      under_maintenance: 0,
      pending: 0,
    };

    // Map status counts
    statusCounts.forEach((row) => {
      const count = parseInt(row.count, 10);
      counts.total += count;
      
      if (row.status === AssetStatus.AVAILABLE) {
        counts.available = count;
      } else if (row.status === AssetStatus.ASSIGNED) {
        counts.assigned = count;
      } else if (row.status === AssetStatus.RETIRED) {
        counts.retired = count;
      } else if (row.status === AssetStatus.UNDER_MAINTENANCE) {
        counts.under_maintenance = count;
      }
    });

    // Get pending asset requests count
    const pendingRequestsCount = await this.assetRequestRepo.count({
      where: { 
        tenant_id: tenantId, 
        status: AssetRequestStatus.PENDING 
      },
    });
    counts.pending = pendingRequestsCount;

    return {
      items: items.map((a) => ({
        ...a,
        assignedToName: a.assignedToUser
          ? `${a.assignedToUser.first_name ?? ''} ${a.assignedToUser.last_name ?? ''}`.trim()
          : null,
        categoryName: a.category?.name ?? null,
        subcategoryName: a.subcategory?.name ?? null,
      })),
      total,
      page,
      limit,
      totalPages,
      counts,
    };
  }

  async findOne(tenantId: string, id: string) {
    const asset = await this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assignedToUser', 'assignedUser')
      .leftJoinAndSelect('a.category', 'category')
      .leftJoinAndSelect('a.subcategory', 'subcategory')
      .where('a.id = :id AND a.tenant_id = :tenantId', { id, tenantId })
      .getOne();
    if (!asset) throw new NotFoundException('Asset not found');
    return {
      ...asset,
      assignedToName: asset.assignedToUser
        ? `${asset.assignedToUser.first_name ?? ''} ${asset.assignedToUser.last_name ?? ''}`.trim()
        : null,
      categoryName: asset.category?.name ?? null,
      subcategoryName: asset.subcategory?.name ?? null,
    };
  }

  async update(tenantId: string, id: string, dto: UpdateAssetDto) {
    // Get the actual entity, not the modified object from findOne
    const asset = await this.assetRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Update fields
    if (dto.name !== undefined) {
      asset.name = dto.name;
    }
    if (dto.categoryId !== undefined) {
      asset.category_id = dto.categoryId;
    }
    if (dto.subcategoryId !== undefined) {
      asset.subcategory_id = dto.subcategoryId || null;
    }
    if (dto.status !== undefined) {
      asset.status = dto.status as AssetStatus;
    }
    if (dto.assignedTo !== undefined) {
      asset.assigned_to = dto.assignedTo || null;
    }
    if (dto.purchaseDate !== undefined) {
      asset.purchase_date = dto.purchaseDate || null;
    }

    return await this.assetRepo.save(asset);
  }

  async softDelete(tenantId: string, id: string) {
    const asset = await this.findOne(tenantId, id);
    asset.status = AssetStatus.RETIRED;
    return this.assetRepo.save(asset);
  }
}