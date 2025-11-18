import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { PerformanceReview } from "src/entities/performance-review.entity";
import { EmployeeKpi } from "src/entities/employee-kpi.entity";
import { CreatePerformanceReviewDto } from "../dtos/performance-review/create-performance-review.dto";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";
import { PaginationResponse } from "src/common/interfaces/pagination.interface";

@Injectable()
export class PerformanceReviewService {
  constructor(
    @InjectRepository(PerformanceReview)
    private readonly reviewRepo: Repository<PerformanceReview>,

    @InjectRepository(EmployeeKpi)
    private readonly employeeKpiRepo: Repository<EmployeeKpi>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  /**
   * Create a new performance review
   */
  async create(
    tenantId: string,
    reviewedBy: string,
    dto: CreatePerformanceReviewDto,
  ) {
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
      const review = this.reviewRepo.create({
        ...dto,
        employee_id: dto.employeeId,
        tenant_id: tenantId,
        reviewedBy,
        status: "under_review",
      });

      return this.reviewRepo.save(review);
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
   * Get all reviews (optionally filter by cycle)
   */
  async findAll(tenantId: string, cycle?: string, page: number = 1, limit: number = 25): Promise<PaginationResponse<PerformanceReview>> {
    const skip = (page - 1) * limit;
    const query = this.reviewRepo
      .createQueryBuilder("review")
      .where("review.tenant_id = :tenantId", { tenantId })
      .leftJoinAndSelect("review.employee", "employee")
      .orderBy("review.createdAt", "DESC");

    if (cycle) query.andWhere("review.cycle = :cycle", { cycle });

    const [items, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get a single review by ID
   */
  async findOne(tenantId: string, id: string) {
    const review = await this.reviewRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ["employee"],
    });

    if (!review) throw new NotFoundException("Performance review not found.");

    const kpis = await this.employeeKpiRepo.find({
      where: {
        tenant_id: tenantId,
        employee_id: review.employee_id,
        reviewCycle: review.cycle,
      },
    });

    review["kpis"] = kpis;

    return review;
  }

  /**
   * Approve and finalize a review
   */
  async approve(
    tenantId: string,
    id: string,
    approvedBy: string,
    recommendation?: string,
  ) {
    const review = await this.reviewRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!review) throw new NotFoundException("Performance review not found.");

    if (review.status === "completed") {
      throw new BadRequestException("Review already approved.");
    }

    review.status = "completed";
    review.approvedBy = approvedBy;
    if (recommendation) review.recommendation = recommendation;

    return this.reviewRepo.save(review);
  }
}
