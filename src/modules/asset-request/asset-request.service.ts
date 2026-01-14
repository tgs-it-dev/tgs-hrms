import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { AssetRequest } from '../../entities/asset-request.entity';
import { AssetComment } from '../../entities/asset-comment.entity';
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
    @InjectRepository(AssetComment)
    private readonly assetCommentRepo: Repository<AssetComment>,
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
    // Get the actual entity instance, not the enriched object
    const req = await this.reqRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!req) {
      throw new NotFoundException('Request not found');
    }

    if (req.status !== AssetRequestStatus.PENDING) {
      throw new BadRequestException('Request already processed');
    }

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
    if (!asset) {
      throw new BadRequestException('No available asset matching request criteria');
    }

    // assign asset
    asset.status = AssetStatus.ASSIGNED;
    asset.assigned_to = req.requested_by;
    await this.assetRepo.save(asset);

    // update request and link asset - using entity instance
    req.status = AssetRequestStatus.APPROVED;
    req.approved_by = adminId;
    req.approved_date = new Date().toISOString().slice(0, 10);
    req.asset_id = asset.id;
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

  /**
   * Get asset requests from manager's team members
   * Only managers can access this endpoint
   */
  async getTeamAssetRequests(
    managerId: string,
    tenantId: string,
    page: number = 1,
    filters?: { status?: AssetRequestStatus },
  ) {
    // Get manager's teams
    const managerTeams = await this.teamRepo.find({
      where: { manager_id: managerId },
      select: ['id'],
    });

    if (managerTeams.length === 0) {
      throw new ForbiddenException('You are not managing any teams');
    }

    const teamIds = managerTeams.map((t) => t.id);

    // Get employee user IDs in manager's teams
    const teamEmployees = await this.employeeRepo
      .createQueryBuilder('e')
      .select('e.user_id', 'userId')
      .where('e.team_id IN (:...teamIds)', { teamIds })
      .getRawMany();

    const employeeUserIds = teamEmployees.map((emp) => emp.userId);

    if (employeeUserIds.length === 0) {
      // Manager has teams but no employees
      return {
        items: [],
        total: 0,
        page,
        limit: 25,
        totalPages: 0,
        counts: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          cancelled: 0,
        },
      };
    }

    const limit = 25;
    const skip = (page - 1) * limit;

    // Build query for team members' requests
    const qb = this.reqRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requestedByUser', 'requestedByUser')
      .leftJoinAndSelect('r.approvedByUser', 'approvedByUser')
      .leftJoinAndSelect('r.category', 'category')
      .leftJoinAndSelect('r.subcategory', 'subcategory')
      .leftJoinAndSelect('r.asset', 'asset')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.requested_by IN (:...employeeUserIds)', { employeeUserIds })
      .orderBy('r.created_at', 'DESC');

    // Apply status filter if provided
    if (filters?.status) {
      qb.andWhere('r.status = :status', { status: filters.status });
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    // Get counts for all statuses
    const statusCountsQuery = this.reqRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.requested_by IN (:...employeeUserIds)', { employeeUserIds });

    const statusCounts = await statusCountsQuery.groupBy('r.status').getRawMany();

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
        assetName: r.asset?.name ?? null,
      })),
      total,
      page,
      limit,
      totalPages,
      counts,
    };
  }

  /**
   * Add a comment to an asset request
   * Managers can only comment on requests from their team members
   */
  async addComment(
    requestId: string,
    userId: string,
    tenantId: string,
    userRole: string,
    comment: string,
  ): Promise<AssetComment> {
    // Verify asset request exists
    const assetRequest = await this.reqRepo.findOne({
      where: { id: requestId, tenant_id: tenantId },
      relations: ['requestedByUser'],
    });

    if (!assetRequest) {
      throw new NotFoundException('Asset request not found');
    }

    // Check if manager can comment on this request
    // Manager can only comment if the request is from their team member
    const roleLower = userRole.toLowerCase();

    if (roleLower === 'manager') {
      // Get manager's teams
      const managerTeams = await this.teamRepo.find({
        where: { manager_id: userId },
        select: ['id'],
      });

      const teamIds = managerTeams.map((t) => t.id);

      if (teamIds.length === 0) {
        throw new ForbiddenException('You are not managing any teams');
      }

      // Check if the requester is in manager's team
      const requesterEmployee = await this.employeeRepo.findOne({
        where: { user_id: assetRequest.requested_by },
      });

      if (
        !requesterEmployee ||
        !requesterEmployee.team_id ||
        !teamIds.includes(requesterEmployee.team_id)
      ) {
        throw new ForbiddenException(
          'You can only comment on asset requests from your team members',
        );
      }
    }
    // HR Admin and Admin roles can comment on any request
    // No additional checks needed

    // Create comment
    const commentEntity = this.assetCommentRepo.create({
      asset_request_id: requestId,
      commented_by: userId,
      comment: comment,
      tenant_id: tenantId,
    });

    return await this.assetCommentRepo.save(commentEntity);
  }

  /**
   * Get all comments for an asset request
   */
  async getComments(requestId: string, tenantId: string): Promise<AssetComment[]> {
    // Verify asset request exists
    const assetRequest = await this.reqRepo.findOne({
      where: { id: requestId, tenant_id: tenantId },
    });

    if (!assetRequest) {
      throw new NotFoundException('Asset request not found');
    }

    return await this.assetCommentRepo.find({
      where: { asset_request_id: requestId, tenant_id: tenantId },
      relations: ['commentedByUser'],
      order: { created_at: 'DESC' },
    });
  }
}
