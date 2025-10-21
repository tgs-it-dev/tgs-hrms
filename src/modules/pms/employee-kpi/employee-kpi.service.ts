import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";
import { EmployeeKpi } from "src/entities/employee-kpi.entity";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";
import { Kpi } from "src/entities/kpi.entity";
import { CreateEmployeeKpiDto } from "../dtos/employee-kpi/create-employee-kpi.dto";
import { UpdateEmployeeKpiDto } from "../dtos/employee-kpi/update-employee-kpi.dto";
import { User } from "src/entities/user.entity";

@Injectable()
export class EmployeeKpiService {
  constructor(
    @InjectRepository(EmployeeKpi)
    private readonly employeeKpiRepo: Repository<EmployeeKpi>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Kpi)
    private readonly kpiRepo: Repository<Kpi>,
  ) {}

  async create(tenant_id: string, dto: CreateEmployeeKpiDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenant_id } });

    if (!tenant) throw new BadRequestException("Invalid tenant ID");

    const employee = await this.employeeRepo
      .createQueryBuilder("employee")
      .innerJoin("employee.user", "user")
      .where("employee.id = :employeeId", { employeeId: dto.employeeId })
      .andWhere("user.tenant_id = :tenantId", { tenantId: tenant_id })
      .getOne();

    if (!employee) throw new BadRequestException("Invalid employee ID");

    if (dto.reviewedBy) {
      const manager = await this.userRepo
        .createQueryBuilder("user")
        .leftJoin("user.role", "role")
        .where("user.id = :reviewedBy", { reviewedBy: dto.reviewedBy })
        .andWhere("role.name = :role", { role: "Manager" })
        .getOne();

      if (!manager)
        throw new BadRequestException("Invalid manager ID for reviewedBy");
    }

    const kpi = await this.kpiRepo.findOne({
      where: { id: dto.kpiId, tenant_id, status: "active" },
    });
    if (!kpi) throw new BadRequestException("No active KPI for given ID");

    // Prevent duplicate entry for same employee + KPI + cycle
    const existing = await this.employeeKpiRepo.findOne({
      where: {
        employee_id: dto.employeeId,
        kpi_id: dto.kpiId,
        reviewCycle: dto.reviewCycle,
        tenant_id,
      },
    });

    if (existing) {
      throw new ConflictException(
        `KPI already assigned to this employee for ${dto.reviewCycle}.`,
      );
    }

    let score: number = 0;
    if (dto.achievedValue && dto.targetValue && dto.targetValue > 0) {
      const ratio = dto.achievedValue / dto.targetValue;
      score = Math.min(5, Math.max(1, ratio * 5)); // Clamp between 1–5
    }

    try {
      const record = this.employeeKpiRepo.create({
        ...dto,
        kpi_id: dto.kpiId,
        employee_id: dto.employeeId,
        tenant_id,
        score,
      });

      return await this.employeeKpiRepo.save(record);
    } catch (err: unknown) {
      if (err instanceof QueryFailedError) {
        const code = (err as QueryFailedError & { code?: string }).code;
        if (code === "23505") {
          throw new ConflictException("Duplicate KPI entry for this employee");
        }
        if (code === "23502") {
          throw new BadRequestException("Missing required fields");
        }
      }
      throw err;
    }
  }

  /**
   * List Employee KPIs filtered by employeeId and/or review cycle
   */
  async findAllByTenant(tenantId: string, employeeId?: string, cycle?: string) {
    const qb = this.employeeKpiRepo
      .createQueryBuilder("ekpi")
      .leftJoinAndSelect("ekpi.kpi", "kpi")
      .leftJoinAndSelect("ekpi.employee", "employee")
      .where("ekpi.tenant_id = :tenantId", { tenantId });

    if (employeeId)
      qb.andWhere("ekpi.employee_id = :employeeId", { employeeId });

    if (cycle) qb.andWhere("ekpi.reviewCycle = :cycle", { cycle });

    qb.orderBy("ekpi.createdAt", "DESC");

    return await qb.getMany();
  }

  /**
   * Update Employee KPI
   */
  async update(tenant_id: string, id: string, dto: UpdateEmployeeKpiDto) {
    const record = await this.employeeKpiRepo.findOne({
      where: { id, tenant_id },
    });

    if (!record) {
      throw new NotFoundException("Employee KPI record not found.");
    }

    if (dto.reviewedBy) {
      const manager = await this.userRepo
        .createQueryBuilder("user")
        .leftJoin("user.role", "role")
        .where("user.id = :reviewedBy", { reviewedBy: dto.reviewedBy })
        .andWhere("role.name = :role", { role: "Manager" })
        .getOne();

      if (!manager)
        throw new BadRequestException("Invalid manager ID for reviewedBy");
    }

    Object.assign(record, dto);

    const target = dto.targetValue ?? record.targetValue;
    const achieved = dto.achievedValue ?? record.achievedValue;

    if (achieved && target && target > 0) {
      record.score = Math.min(5, Math.max(1, (achieved / target) * 5));
    }

    try {
      return await this.employeeKpiRepo.save(record);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code === "23505"
      ) {
        throw new ConflictException("Duplicate KPI entry for this employee");
      }
      throw err;
    }
  }

  /**
   * Calculate KPI summary (weighted performance score) for an employee and cycle
   */
  async getSummary(tenantId: string, employeeId: string, cycle: string) {
    const records = await this.employeeKpiRepo
      .createQueryBuilder("ekpi")
      .leftJoinAndSelect("ekpi.kpi", "kpi")
      .where("ekpi.employee_id = :employeeId", { employeeId })
      .andWhere("ekpi.reviewCycle = :cycle", { cycle })
      .andWhere("ekpi.tenant_id = :tenantId", { tenantId })
      .getMany();

    if (!records.length) {
      throw new NotFoundException("No KPI records found for this cycle.");
    }

    const totalScore = records.reduce((sum, r) => {
      if (!r.kpi || !r.score) return sum;
      const weighted = r.score * (r.kpi.weight / 100); // achieved / target * weight (weight not in percentage after division)
      return sum + weighted;
    }, 0);

    return {
      employeeId,
      cycle,
      totalScore: Number(totalScore.toFixed(2)),
      recordCount: records.length,
    };
  }
}
