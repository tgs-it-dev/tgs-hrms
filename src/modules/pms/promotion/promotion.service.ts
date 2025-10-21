import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { Promotion } from "src/entities/promotion.entity";
import { CreatePromotionDto } from "../dtos/promotion/create-promotion.dto";
import { ApprovePromotionDto } from "../dtos/promotion/approve-promotion.dto";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  /**
   * Create a new promotion request
   */
  async create(tenantId: string, dto: CreatePromotionDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });

    if (!tenant) throw new BadRequestException("Invalid tenant ID");

    const employee = await this.employeeRepo
      .createQueryBuilder("employee")
      .innerJoin("employee.user", "user")
      .where("employee.id = :employeeId", { employeeId: dto.employeeId })
      .andWhere("user.tenant_id = :tenantId", { tenantId: tenantId })
      .getOne();

    if (!employee) throw new BadRequestException("Invalid employee ID");

    try {
      const promotion = this.promotionRepo.create({
        ...dto,
        employee_id: dto.employeeId,
        tenant_id: tenantId,
        status: "pending",
      });

      return this.promotionRepo.save(promotion);
    } catch (err: unknown) {
      if (err instanceof QueryFailedError) {
        const code = (err as QueryFailedError & { code?: string }).code;
        if (code === "23502") {
          throw new BadRequestException("Missing required fields");
        }
      }
      throw err;
    }
  }

  /**
   * Get all promotions (filtered by tenant, optionally by employee)
   */
  async findAll(tenantId: string, employeeId?: string) {
    const query = this.promotionRepo
      .createQueryBuilder("promotion")
      .where("promotion.tenant_id = :tenantId", { tenantId })
      .leftJoinAndSelect("promotion.employee", "employee")
      .orderBy("promotion.createdAt", "DESC");

    if (employeeId)
      query.andWhere("promotion.employee_id = :employeeId", { employeeId });

    return query.getMany();
  }

  /**
   * Get a single promotion by ID
   */
  async findOne(tenantId: string, id: string) {
    const promotion = await this.promotionRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ["employee"],
    });

    if (!promotion) throw new NotFoundException("Promotion record not found.");

    return promotion;
  }

  /**
   * Approve or reject a promotion
   * (Handled by HR Admin)
   */
  async approve(
    tenantId: string,
    id: string,
    approvedBy: string,
    dto: ApprovePromotionDto,
  ) {
    const promotion = await this.promotionRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!promotion) throw new NotFoundException("Promotion not found.");
    if (promotion.status !== "pending") {
      throw new BadRequestException(
        "This promotion has already been processed.",
      );
    }

    promotion.status = dto.status;
    promotion.approvedBy = approvedBy;
    if (dto.remarks) promotion.remarks = dto.remarks;

    return this.promotionRepo.save(promotion);
  }
}
