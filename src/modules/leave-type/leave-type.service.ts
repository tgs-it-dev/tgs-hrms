import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { LeaveType } from "../../entities/leave-type.entity";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";
import { PaginationResponse } from "../../common/interfaces/pagination.interface";
import { TenantDatabaseService } from "../../common/services/tenant-database.service";

@Injectable()
export class LeaveTypeService {
  constructor(
    @InjectRepository(LeaveType)
    private leaveTypeRepo: Repository<LeaveType>,
    private readonly tenantDbService: TenantDatabaseService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<
      { schema_provisioned: boolean }[]
    >(`SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`, [
      tenantId,
    ]);
    return result[0]?.schema_provisioned ?? false;
  }

  private async runInTenantContext<T>(
    tenantId: string,
    work: (repo: Repository<LeaveType>, em: EntityManager | null) => Promise<T>,
  ): Promise<T> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        work(em.getRepository(LeaveType), em),
      );
    }
    return work(this.leaveTypeRepo, null);
  }

  async create(
    createLeaveTypeDto: CreateLeaveTypeDto,
    tenantId: string,
    createdBy: string,
  ): Promise<LeaveType> {
    return this.runInTenantContext(tenantId, async (repo) => {
      const leaveType = repo.create({
        ...createLeaveTypeDto,
        isPaid:
          createLeaveTypeDto.isPaid !== undefined
            ? createLeaveTypeDto.isPaid
            : true,
        tenantId,
        createdBy,
      });
      return repo.save(leaveType);
    });
  }

  async findAll(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginationResponse<LeaveType>> {
    const skip = (page - 1) * limit;
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const fetch = (repo: Repository<LeaveType>) =>
      repo.findAndCount({
        where: { tenantId, status: "active" },
        order: { createdAt: "DESC" },
        skip,
        take: limit,
      });

    const [items, total] = isProvisioned
      ? await this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
          fetch(em.getRepository(LeaveType)),
        )
      : await fetch(this.leaveTypeRepo);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string): Promise<LeaveType> {
    return this.runInTenantContext(tenantId, async (repo) => {
      const leaveType = await repo.findOne({ where: { id, tenantId } });
      if (!leaveType) {
        throw new NotFoundException("Leave type not found");
      }
      return leaveType;
    });
  }

  async update(
    id: string,
    updateLeaveTypeDto: UpdateLeaveTypeDto,
    tenantId: string,
  ): Promise<LeaveType> {
    return this.runInTenantContext(tenantId, async (repo) => {
      const leaveType = await repo.findOne({ where: { id, tenantId } });
      if (!leaveType) {
        throw new NotFoundException("Leave type not found");
      }
      Object.assign(leaveType, updateLeaveTypeDto);
      return repo.save(leaveType);
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.runInTenantContext(tenantId, async (repo) => {
      const leaveType = await repo.findOne({ where: { id, tenantId } });
      if (!leaveType) {
        throw new NotFoundException("Leave type not found");
      }
      leaveType.status = "inactive";
      await repo.save(leaveType);
    });
  }
}
