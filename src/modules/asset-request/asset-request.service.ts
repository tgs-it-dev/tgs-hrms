import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { AssetRequest } from '../../entities/asset-request.entity';
import { Employee } from '../../entities/employee.entity';
import { Team } from '../../entities/team.entity';
import { CreateAssetRequestDto } from './dto/create-asset-request.dto';
import { AssetRequestStatus, AssetStatus } from '../../common/constants/enums';

@Injectable()
export class AssetRequestService {
  constructor(
    @InjectRepository(AssetRequest)
    private readonly reqRepo: Repository<AssetRequest>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
  ) {}

  async create(dto: CreateAssetRequestDto, userId: string, tenantId: string) {
    const entity = this.reqRepo.create({
      category_id: dto.categoryId,
      subcategory_id: dto.subcategoryId ?? null,
      requested_by: userId,
      status: AssetRequestStatus.PENDING,
      requested_date: new Date().toISOString().slice(0, 10),
      tenant_id: tenantId,
      remarks: dto.remarks ?? null,
    });
    return this.reqRepo.save(entity);
  }

  async findAll(tenantId: string, page = 1, userId: string, userRole?: string) {
    const limit = 25;
    const skip = (page - 1) * limit;

    const qb = this.reqRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requestedByUser', 'requestedByUser')
      .leftJoinAndSelect('r.approvedByUser', 'approvedByUser')
      .leftJoinAndSelect('r.category', 'category')
      .leftJoinAndSelect('r.subcategory', 'subcategory')
      .where('r.tenant_id = :tenantId', { tenantId })
      .orderBy('r.created_at', 'DESC');

    // Admin roles ko sab ki requests dikhani chahiye (approve/reject ke liye)
    const adminRoles = ['network-admin', 'system-admin', 'admin', 'hr-admin'];
    const isAdmin = userRole && adminRoles.includes(userRole.toLowerCase());
    
    if (!isAdmin) {
      // Regular users (employee, manager, user): only their own requests
      if (userId) {
        qb.andWhere('r.requested_by = :userId', { userId });
      } else {
        // If no userId provided, return empty result
        qb.andWhere('1 = 0'); // Always false condition
      }
    }
    // Admin roles: no additional filter, show all requests in tenant

    const [items, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    // Get counts for all statuses with same filtering
    const statusCountsQuery = this.reqRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.tenant_id = :tenantId', { tenantId });

    // Apply same filtering to counts
    if (!isAdmin) {
      // Regular users: only their own requests
      if (userId) {
        statusCountsQuery.andWhere('r.requested_by = :userId', { userId });
      } else {
        // If no userId provided, return empty result
        statusCountsQuery.andWhere('1 = 0'); // Always false condition
      }
    }
    // Admin roles: no additional filter, show all requests in tenant

    const statusCounts = await statusCountsQuery
      .groupBy('r.status')
      .getRawMany();

    // Initialize counts
    const counts = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    };

    // Map status counts
    statusCounts.forEach((row) => {
      const count = parseInt(row.count, 10);
      counts.total += count;
      
      if (row.status === AssetRequestStatus.PENDING) {
        counts.pending = count;
      } else if (row.status === AssetRequestStatus.APPROVED) {
        counts.approved = count;
      } else if (row.status === AssetRequestStatus.REJECTED) {
        counts.rejected = count;
      } else if (row.status === AssetRequestStatus.CANCELLED) {
        counts.cancelled = count;
      }
    });

    return {
      items: items.map((r) => ({
        ...r,
        requestedByName: r.requestedByUser
          ? `${r.requestedByUser.first_name ?? ''} ${r.requestedByUser.last_name ?? ''}`.trim()
          : null,
        approvedByName: r.approvedByUser
          ? `${r.approvedByUser.first_name ?? ''} ${r.approvedByUser.last_name ?? ''}`.trim()
          : null,
        subcategoryName: r.subcategory?.name ?? null,
      })),
      total,
      page,
      limit,
      totalPages,
      counts,
    };
  }

  async findOne(tenantId: string, id: string) {
    const req = await this.reqRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requestedByUser', 'requestedByUser')
      .leftJoinAndSelect('r.approvedByUser', 'approvedByUser')
      .leftJoinAndSelect('r.subcategory', 'subcategory')
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
      subcategoryName: req.subcategory?.name ?? null,
    };
  }

  async approve(id: string, adminId: string, tenantId: string) {
    const req = await this.findOne(tenantId, id);
    if (req.status !== AssetRequestStatus.PENDING) throw new BadRequestException('Request already processed');

    const assetQuery = this.assetRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.category_id = :catId', { catId: req.category_id })
      .andWhere('a.status = :st', { st: AssetStatus.AVAILABLE });

    // Match subcategory if specified in request
    if (req.subcategory_id) {
      assetQuery.andWhere('a.subcategory_id = :subcatId', { subcatId: req.subcategory_id });
    } else {
      assetQuery.andWhere('a.subcategory_id IS NULL');
    }

    const asset = await assetQuery.getOne();
    if (!asset) throw new BadRequestException('No available asset matching request criteria');

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

  async reject(id: string, adminId: string, tenantId: string, rejectionReason?: string) {
    const req = await this.findOne(tenantId, id);
    if (req.status !== AssetRequestStatus.PENDING) throw new BadRequestException('Request already processed');
    req.status = AssetRequestStatus.REJECTED;
    req.approved_by = adminId;
    req.approved_date = new Date().toISOString().slice(0, 10);
    req.rejection_reason = rejectionReason || null;
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
