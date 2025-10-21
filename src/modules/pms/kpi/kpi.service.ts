import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Kpi } from "src/entities/kpi.entity";
import { Tenant } from "src/entities/tenant.entity";
import { Repository, QueryFailedError } from "typeorm";
import { CreateKpiDto } from "../dtos/kpi/create-kpi.dto";
import { UpdateKpiDto } from "../dtos/kpi/update-kpi.dto";

@Injectable()
export class KpiService {
  constructor(
    @InjectRepository(Kpi)
    private readonly kpiRepo: Repository<Kpi>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /**
   * Create a new KPI
   */
  async create(tenant_id: string, createdBy: string, dto: CreateKpiDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenant_id } });
    if (!tenant) {
      throw new BadRequestException("Invalid tenant ID");
    }

    // Ensure unique title within the same tenant
    const existing = await this.kpiRepo.findOne({
      where: { title: dto.title, tenant_id },
    });

    if (existing) {
      throw new ConflictException(
        `KPI with title '${dto.title}' already exists for this tenant.`,
      );
    }

    try {
      const kpi = this.kpiRepo.create({
        ...dto,
        tenant_id,
        createdBy,
      });
      return await this.kpiRepo.save(kpi);
    } catch (err: unknown) {
      if (err instanceof QueryFailedError) {
        const code = (err as QueryFailedError & { code?: string }).code;
        if (code === "23505") {
          throw new ConflictException(
            "KPI title must be unique for this tenant",
          );
        }
        if (code === "23502") {
          throw new BadRequestException("Missing required fields");
        }
      }
      throw err;
    }
  }

  /**
   * Update existing KPI
   */
  async update(tenant_id: string, id: string, dto: UpdateKpiDto) {
    const kpi = await this.findOne(tenant_id, id);

    // If updating title, ensure uniqueness
    if (dto.title && dto.title !== kpi.title) {
      const exists = await this.kpiRepo.findOne({
        where: { title: dto.title, tenant_id },
      });

      if (exists && exists.id !== id) {
        throw new ConflictException(
          `KPI with title '${dto.title}' already exists for this tenant.`,
        );
      }
    }

    Object.assign(kpi, dto);

    try {
      return await this.kpiRepo.save(kpi);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code === "23505"
      ) {
        throw new ConflictException("KPI title must be unique for this tenant");
      }
      throw err;
    }
  }

  /**
   * Get paginated list of KPIs by tenant
   */
  async findAllByTenant(tenant_id: string, page = 1) {
    const limit = 25;
    const skip = (page - 1) * limit;

    return await this.kpiRepo.find({
      where: { tenant_id },
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });
  }

  /**
   * Get single KPI by id
   */
  async findOne(tenant_id: string, id: string) {
    const kpi = await this.kpiRepo.findOneBy({ id, tenant_id });
    if (!kpi) {
      throw new NotFoundException("KPI not found.");
    }
    return kpi;
  }

  /**
   * Delete KPI
   */
  async remove(
    tenant_id: string,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    await this.findOne(tenant_id, id); // ensure it exists
    await this.kpiRepo.delete(id);
    return { deleted: true, id };
  }
}
