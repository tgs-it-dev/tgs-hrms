import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";
import { Benefit } from "../../entities/benefit.entity";
import { Tenant } from "../../entities/tenant.entity";
import { CreateBenefitDto } from "./dto/benefit/create-benefit.dto";
import { UpdateBenefitDto } from "./dto/benefit/update-benefit.dto";
import { PaginationResponse } from "../../common/interfaces/pagination.interface";

@Injectable()
export class BenefitsService {
  constructor(
    @InjectRepository(Benefit)
    private readonly benefitRepo: Repository<Benefit>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) { }

  async create(tenant_id: string, createdBy: string, dto: CreateBenefitDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenant_id } });
    if (!tenant) {
      throw new BadRequestException("Invalid tenant ID");
    }

    // Ensure unique benefit name within same tenant
    const existing = await this.benefitRepo.findOne({
      where: { name: dto.name, tenant_id },
    });
    if (existing) {
      throw new ConflictException(
        `Benefit with name '${dto.name}' already exists for this tenant.`,
      );
    }

    try {
      const benefit = this.benefitRepo.create({
        ...dto,
        tenant_id,
        createdBy,
      });
      return await this.benefitRepo.save(benefit);
    } catch (err: unknown) {
      if (err instanceof QueryFailedError) {
        const code: unknown = (err as QueryFailedError & { code?: string })
          .code;
        if (code === "23505") {
          throw new ConflictException(
            "Benefit name must be unique for this tenant",
          );
        }
        if (code === "23502") {
          throw new BadRequestException("Missing required fields");
        }
      }
      throw err;
    }
  }

  async update(tenant_id: string, id: string, dto: UpdateBenefitDto) {
    const benefit = await this.findOne(tenant_id, id);

    // If updating name, ensure uniqueness
    if (dto.name && dto.name !== benefit.name) {
      const exists = await this.benefitRepo.findOne({
        where: { name: dto.name, tenant_id: benefit.tenant_id },
      });

      if (exists && exists.id !== id) {
        throw new ConflictException(
          `Benefit with name '${dto.name}' already exists for this tenant.`,
        );
      }
    }

    Object.assign(benefit, dto);

    try {
      return await this.benefitRepo.save(benefit);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code === "23505"
      ) {
        throw new ConflictException(
          "Benefit name must be unique for this tenant",
        );
      }
      throw err;
    }
  }

  async findAllByTenant(
    tenant_id: string,
    page = 1,
    type?: string,
    status?: "active" | "inactive",
  ): Promise<PaginationResponse<Benefit>> {
    const limit = 25;
    const skip = (page - 1) * limit;

    const qb = this.benefitRepo
      .createQueryBuilder("benefit")
      .where("benefit.tenant_id = :tenant_id", { tenant_id });

    if (type && type.trim()) {
      qb.andWhere("benefit.type = :type", { type: type.trim() });
    }
    if (status === "active" || status === "inactive") {
      qb.andWhere("benefit.status = :status", { status });
    }

    const [items, total] = await qb
      .orderBy("benefit.created_at", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Get all benefits for export (same filters as list, no pagination). */
  async findAllForExport(
    tenant_id: string,
    type?: string,
    status?: "active" | "inactive",
  ): Promise<Benefit[]> {
    const qb = this.benefitRepo
      .createQueryBuilder("benefit")
      .where("benefit.tenant_id = :tenant_id", { tenant_id });

    if (type && type.trim()) {
      qb.andWhere("benefit.type = :type", { type: type.trim() });
    }
    if (status === "active" || status === "inactive") {
      qb.andWhere("benefit.status = :status", { status });
    }

    return qb.orderBy("benefit.created_at", "DESC").getMany();
  }

  async findOne(tenant_id: string, id: string) {
    const benefit = await this.benefitRepo.findOneBy({ id, tenant_id });
    if (!benefit) {
      throw new NotFoundException("Benefit not found.");
    }
    return benefit;
  }

  async remove(
    tenant_id: string,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    await this.findOne(tenant_id, id); // ensure it exists

    try {
      await this.benefitRepo.delete(id);
      return { deleted: true, id };
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const code: unknown = (err as QueryFailedError & { code?: string })
          .code;
        if (code === "23503") {
          throw new ConflictException(
            "Cannot delete benefit as it is assigned to one or more employees.",
          );
        }
      }
      throw err;
    }
  }
}
