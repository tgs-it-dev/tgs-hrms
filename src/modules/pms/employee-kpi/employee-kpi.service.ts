import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";
import { EmployeeKpi } from "src/entities/employee-kpi.entity";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";
import { Kpi } from "src/entities/kpi.entity";
import { Team } from "src/entities/team.entity";
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

    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
  ) {}

  async create(
    tenant_id: string,
    dto: CreateEmployeeKpiDto,
    userId?: string,
    userRole?: string,
  ) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenant_id } });

    if (!tenant) throw new BadRequestException("Invalid tenant ID");

    const employee = await this.employeeRepo
      .createQueryBuilder("employee")
      .innerJoin("employee.user", "user")
      .where("employee.id = :employeeId", { employeeId: dto.employeeId })
      .andWhere("user.tenant_id = :tenantId", { tenantId: tenant_id })
      .getOne();

    if (!employee) throw new BadRequestException("Invalid employee ID");

    // If user is manager, validate that employee belongs to their team
    if (userRole && userRole.toLowerCase() === "manager" && userId) {
      const managerTeams = await this.teamRepo.find({
        where: { manager_id: userId },
        select: ["id"],
      });

      if (managerTeams.length === 0) {
        throw new ForbiddenException("You are not managing any teams");
      }

      const teamIds = managerTeams.map((t) => t.id);

      // Check if employee belongs to manager's team
      if (!employee.team_id || !teamIds.includes(employee.team_id)) {
        throw new ForbiddenException(
          "You can only assign KPIs to employees in your teams",
        );
      }
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
  async update(
    tenant_id: string,
    id: string,
    dto: UpdateEmployeeKpiDto,
    userId?: string,
    userRole?: string,
  ) {
    const record = await this.employeeKpiRepo.findOne({
      where: { id, tenant_id },
      relations: ["employee"],
    });

    if (!record) {
      throw new NotFoundException("Employee KPI record not found.");
    }

    // If user is manager, validate that employee belongs to their team
    if (userRole && userRole.toLowerCase() === "manager" && userId) {
      const managerTeams = await this.teamRepo.find({
        where: { manager_id: userId },
        select: ["id"],
      });

      if (managerTeams.length === 0) {
        throw new ForbiddenException("You are not managing any teams");
      }

      const teamIds = managerTeams.map((t) => t.id);

      // Get employee with team info
      const employee = await this.employeeRepo.findOne({
        where: { id: record.employee_id },
      });

      if (!employee) {
        throw new NotFoundException("Employee not found");
      }

      // Check if employee belongs to manager's team
      if (!employee.team_id || !teamIds.includes(employee.team_id)) {
        throw new ForbiddenException(
          "You can only update KPIs of employees in your teams",
        );
      }
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
  async getSummary(tenantId: string, employeeId: string, cycle?: string) {
    const queryBuilder = this.employeeKpiRepo
      .createQueryBuilder("ekpi")
      .leftJoinAndSelect("ekpi.kpi", "kpi")
      .where("ekpi.employee_id = :employeeId", { employeeId })
      .andWhere("ekpi.tenant_id = :tenantId", { tenantId });

    if (cycle) {
      queryBuilder.andWhere("ekpi.reviewCycle = :cycle", { cycle });
    }

    const records = await queryBuilder.getMany();

    if (!records.length) {
      throw new NotFoundException(
        cycle
          ? "No KPI records found for this cycle."
          : "No KPI records found for this employee.",
      );
    }

    const totalScore = records.reduce((sum, r) => {
      if (!r.kpi || !r.score) return sum;
      const weighted = r.score * (r.kpi.weight / 100); // achieved / target * weight (weight not in percentage after division)
      return sum + weighted;
    }, 0);

    return {
      employeeId,
      cycle: cycle || null,
      totalScore: Number(totalScore.toFixed(2)),
      recordCount: records.length,
    };
  }

  /**
   * Get KPIs for all team members (Manager only)
   */
  async getTeamEmployeeKpis(
    managerId: string,
    tenantId: string,
    cycle?: string,
  ) {
    // Get manager's teams
    const managerTeams = await this.teamRepo.find({
      where: { manager_id: managerId },
      select: ["id"],
    });

    if (managerTeams.length === 0) {
      throw new ForbiddenException("You are not managing any teams");
    }

    const teamIds = managerTeams.map((t) => t.id);

    // Get employee IDs in manager's teams
    const teamEmployees = await this.employeeRepo
      .createQueryBuilder("e")
      .select("e.id", "id")
      .where("e.team_id IN (:...teamIds)", { teamIds })
      .getRawMany();

    const employeeIds = teamEmployees.map((emp) => emp.id);

    if (employeeIds.length === 0) {
      return [];
    }

    // Build query for team members' KPIs
    const qb = this.employeeKpiRepo
      .createQueryBuilder("ekpi")
      .leftJoinAndSelect("ekpi.kpi", "kpi")
      .leftJoinAndSelect("ekpi.employee", "employee")
      .leftJoinAndSelect("employee.user", "user")
      .where("ekpi.tenant_id = :tenantId", { tenantId })
      .andWhere("ekpi.employee_id IN (:...employeeIds)", { employeeIds })
      .orderBy("ekpi.createdAt", "DESC");

    if (cycle) {
      qb.andWhere("ekpi.reviewCycle = :cycle", { cycle });
    }

    return await qb.getMany();
  }

  /**
   * Get KPI summary for all team members (Manager only)
   */
  async getTeamEmployeeKpiSummary(
    managerId: string,
    tenantId: string,
    cycle?: string,
  ) {
    // Get manager's teams
    const managerTeams = await this.teamRepo.find({
      where: { manager_id: managerId },
      select: ["id"],
    });

    if (managerTeams.length === 0) {
      throw new ForbiddenException("You are not managing any teams");
    }

    const teamIds = managerTeams.map((t) => t.id);

    // Get employee IDs in manager's teams
    const teamEmployees = await this.employeeRepo
      .createQueryBuilder("e")
      .select("e.id", "id")
      .leftJoinAndSelect("e.user", "user")
      .where("e.team_id IN (:...teamIds)", { teamIds })
      .getRawMany();

    const employeeIds = teamEmployees.map((emp) => emp.id);

    if (employeeIds.length === 0) {
      return [];
    }

    // Get all KPIs for team members (optionally filtered by cycle)
    const queryBuilder = this.employeeKpiRepo
      .createQueryBuilder("ekpi")
      .leftJoinAndSelect("ekpi.kpi", "kpi")
      .leftJoinAndSelect("ekpi.employee", "employee")
      .leftJoinAndSelect("employee.user", "user")
      .where("ekpi.tenant_id = :tenantId", { tenantId })
      .andWhere("ekpi.employee_id IN (:...employeeIds)", { employeeIds });

    if (cycle) {
      queryBuilder.andWhere("ekpi.reviewCycle = :cycle", { cycle });
    }

    const records = await queryBuilder.getMany();

    // Group by employee and cycle, then calculate summary
    const employeeCycleSummaryMap = new Map<
      string,
      {
        employeeId: string;
        employeeName: string;
        employeeEmail: string;
        cycle: string | null;
        totalScore: number;
        recordCount: number;
        kpis: any[];
      }
    >();

    records.forEach((record) => {
      // Use employee_id + cycle as key to group by both
      const key = `${record.employee_id}_${record.reviewCycle || 'all'}`;
      if (!employeeCycleSummaryMap.has(key)) {
        const employee = record.employee;
        const userName = employee?.user
          ? `${employee.user.first_name || ""} ${employee.user.last_name || ""}`.trim()
          : "Unknown";
        const userEmail = employee?.user?.email || "";

        employeeCycleSummaryMap.set(key, {
          employeeId: record.employee_id,
          employeeName: userName,
          employeeEmail: userEmail,
          cycle: record.reviewCycle || null,
          totalScore: 0,
          recordCount: 0,
          kpis: [],
        });
      }

      const summary = employeeCycleSummaryMap.get(key)!;
      summary.recordCount++;

      if (record.kpi && record.score !== null && record.score !== undefined) {
        const weighted = record.score * (record.kpi.weight / 100);
        summary.totalScore += weighted;
        summary.kpis.push({
          kpiId: record.kpi_id,
          kpiTitle: record.kpi.title,
          targetValue: record.targetValue,
          achievedValue: record.achievedValue,
          score: record.score,
          weight: record.kpi.weight,
          weightedScore: Number(weighted.toFixed(2)),
        });
      }
    });

    // Convert map to array and format
    return Array.from(employeeCycleSummaryMap.values()).map((summary) => ({
      employeeId: summary.employeeId,
      employeeName: summary.employeeName,
      employeeEmail: summary.employeeEmail,
      cycle: summary.cycle,
      totalScore: Number(summary.totalScore.toFixed(2)),
      recordCount: summary.recordCount,
      kpis: summary.kpis,
    }));
  }
}
