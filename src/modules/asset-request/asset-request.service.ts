import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { AssetRequest } from '../../entities/asset-request.entity';
import { CreateAssetRequestDto } from './dto/create-asset-request.dto';

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
      requested_by: userId,
      status: 'pending',
      requested_date: new Date().toISOString().slice(0, 10),
      tenant_id: tenantId,
      remarks: dto.remarks ?? null,
    });
    return this.reqRepo.save(entity);
  }

  async findAll(tenantId: string, requestedBy?: string) {
    const where: any = { tenant_id: tenantId };
    if (requestedBy) where.requested_by = requestedBy;
    return this.reqRepo.find({ where, order: { created_at: 'DESC' } });
  }

  async findOne(tenantId: string, id: string) {
    const req = await this.reqRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!req) throw new NotFoundException('Request not found');
    return req;
  }

  async approve(id: string, adminId: string, tenantId: string) {
    const req = await this.findOne(tenantId, id);
    if (req.status !== 'pending') throw new BadRequestException('Request already processed');

    const asset = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.category = :cat', { cat: req.asset_category })
      .andWhere('a.status = :st', { st: 'available' })
      .getOne();
    if (!asset) throw new BadRequestException('No available asset in category');

    // assign asset
    asset.status = 'assigned';
    asset.assigned_to = req.requested_by;
    await this.assetRepo.save(asset);

    // update request
    req.status = 'approved';
    req.approved_by = adminId;
    req.approved_date = new Date().toISOString().slice(0, 10);
    return this.reqRepo.save(req);
  }

  async reject(id: string, adminId: string, tenantId: string, remarks?: string) {
    const req = await this.findOne(tenantId, id);
    if (req.status !== 'pending') throw new BadRequestException('Request already processed');
    req.status = 'rejected';
    req.approved_by = adminId;
    req.approved_date = new Date().toISOString().slice(0, 10);
    req.remarks = remarks ?? req.remarks;
    return this.reqRepo.save(req);
  }
}


