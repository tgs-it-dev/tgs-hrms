import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { AssetRequest } from '../../entities/asset-request.entity';
import { CreateAssetRequestDto } from './dto/create-asset-request.dto';
import { AssetRequestStatus, AssetStatus } from '../../common/constants/enums';

@Injectable()
export class AssetRequestService {
  constructor(
    @InjectRepository(AssetRequest)
    private readonly reqRepo: Repository<AssetRequest>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
  ) {}

  async create(dto: CreateAssetRequestDto, userId: string, tenantId: string) {
    const entity = this.reqRepo.create({
      asset_category: dto.assetCategory,
      asset_sub_category: dto.assetSubCategory ?? null,
      requested_by: userId,
      status: AssetRequestStatus.PENDING,
      requested_date: new Date().toISOString().slice(0, 10),
      tenant_id: tenantId,
      remarks: dto.remarks ?? null,
    });
    return this.reqRepo.save(entity);
  }

  async findAll(tenantId: string, requestedBy?: string, page = 1) {
    const limit = 25;
    const skip = (page - 1) * limit;

    const qb = this.reqRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requestedByUser', 'requestedByUser')
      .leftJoinAndSelect('r.approvedByUser', 'approvedByUser')
      .where('r.tenant_id = :tenantId', { tenantId })
      .orderBy('r.created_at', 'DESC');

    if (requestedBy) qb.andWhere('r.requested_by = :requestedBy', { requestedBy });

    const [items, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((r) => ({
        ...r,
        requestedByName: r.requestedByUser
          ? `${r.requestedByUser.first_name ?? ''} ${r.requestedByUser.last_name ?? ''}`.trim()
          : null,
        approvedByName: r.approvedByUser
          ? `${r.approvedByUser.first_name ?? ''} ${r.approvedByUser.last_name ?? ''}`.trim()
          : null,
      })),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(tenantId: string, id: string) {
    const req = await this.reqRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requestedByUser', 'requestedByUser')
      .leftJoinAndSelect('r.approvedByUser', 'approvedByUser')
      .where('r.id = :id AND r.tenant_id = :tenantId', { id, tenantId })
      .getOne();
    if (!req) throw new NotFoundException('Request not found');
    return {
      ...req,
      requestedByName: req.requestedByUser
        ? `${req.requestedByUser.first_name ?? ''} ${req.requestedByUser.last_name ?? ''}`.trim()
        : null,
      approvedByName: req.approvedByUser
        ? `${req.approvedByUser.first_name ?? ''} ${req.approvedByUser.last_name ?? ''}`.trim()
        : null,
    };
  }

  async approve(id: string, adminId: string, tenantId: string) {
    const req = await this.findOne(tenantId, id);
    if (req.status !== AssetRequestStatus.PENDING) throw new BadRequestException('Request already processed');

    const qb = this.assetRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.category = :cat', { cat: req.asset_category })
      .andWhere('a.status = :st', { st: AssetStatus.AVAILABLE });

    // If sub_category is specified, also match sub_category
    if (req.asset_sub_category) {
      qb.andWhere('a.sub_category = :subCat', { subCat: req.asset_sub_category });
    }

    const asset = await qb.getOne();
    if (!asset) throw new BadRequestException('No available asset in category');

    // assign asset
    asset.status = AssetStatus.ASSIGNED;
    asset.assigned_to = req.requested_by;
    await this.assetRepo.save(asset);

    // update request
    req.status = AssetRequestStatus.APPROVED;
    req.approved_by = adminId;
    req.approved_date = new Date().toISOString().slice(0, 10);
    await this.reqRepo.save(req);

    // return enriched response with names
    return this.findOne(tenantId, id);
  }

  async reject(id: string, adminId: string, tenantId: string, remarks?: string) {
    const req = await this.findOne(tenantId, id);
    if (req.status !== AssetRequestStatus.PENDING) throw new BadRequestException('Request already processed');
    req.status = AssetRequestStatus.REJECTED;
    req.approved_by = adminId;
    req.approved_date = new Date().toISOString().slice(0, 10);
    req.remarks = remarks ?? req.remarks;
    await this.reqRepo.save(req);
    return this.findOne(tenantId, id);
  }

  async remove(id: string, userId: string, tenantId: string) {
    const req = await this.reqRepo.findOne({ 
      where: { id, tenant_id: tenantId, requested_by: userId } 
    });
    if (!req) throw new NotFoundException('Request not found or not owned by you');
    if (req.status !== AssetRequestStatus.PENDING) throw new BadRequestException('Can only delete pending requests');
    
    await this.reqRepo.remove(req);
    return { message: 'Request deleted successfully' };
  }
}
