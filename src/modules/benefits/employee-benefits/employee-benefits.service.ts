import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Benefit } from "src/entities/benefit.entity";
import { EmployeeBenefit } from "src/entities/employee-benefit.entity";
import { Employee } from "src/entities/employee.entity";
import { Tenant } from "src/entities/tenant.entity";
import { Repository, QueryFailedError, IsNull } from "typeorm";
import { CreateEmployeeBenefitDto } from "../dto/employee-benefit/create-employee-benefit.dto";

@Injectable()
export class EmployeeBenefitsService {
  constructor(
    @InjectRepository(EmployeeBenefit)
    private readonly employeeBenefitRepo: Repository<EmployeeBenefit>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    @InjectRepository(Benefit)
    private readonly benefitRepo: Repository<Benefit>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) { }

  async create(
    tenant_id: string,
    assignedBy: string,
    dto: CreateEmployeeBenefitDto,
  ) {
    // Validate tenant
    const tenant = await this.tenantRepo.findOne({ where: { id: tenant_id } });
    if (!tenant) {
      throw new BadRequestException("Invalid tenant ID");
    }

    // Validate employee
    const employee = await this.employeeRepo
      .createQueryBuilder("employee")
      .innerJoin("employee.user", "user")
      .where("employee.id = :employeeId", { employeeId: dto.employeeId })
      .andWhere("user.tenant_id = :tenantId", { tenantId: tenant_id })
      .getOne();

    if (!employee) {
      throw new BadRequestException("Invalid employee for this tenant");
    }

    // Validate benefit
    const benefit = await this.benefitRepo.findOne({
      where: { id: dto.benefitId, tenant_id, status: "active" },
    });
    if (!benefit) {
      throw new NotFoundException("No active benefit for this tenant");
    }

    // Ensure employee doesn’t already have same active benefit
    const existing = await this.employeeBenefitRepo.findOne({
      where: {
        employeeId: dto.employeeId,
        benefitId: dto.benefitId,
        status: "active",
      },
    });

    if (existing) {
      throw new ConflictException(
        "Employee already has this active benefit assigned",
      );
    }

    try {
      const assignment = this.employeeBenefitRepo.create({
        ...dto,
        assignedBy,
        tenant_id,
      });

      return await this.employeeBenefitRepo.save(assignment);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const code: unknown = (err as QueryFailedError & { code?: string })
          .code;
        if (code === "23505") {
          throw new ConflictException("Duplicate benefit assignment detected");
        }
        if (code === "23502") {
          throw new BadRequestException("Missing required fields");
        }
      }
      throw err;
    }
  }

  /**
   * Mark assignments as expired when end_date has passed (so employee and reimbursement see correct status).
   */
  private async expireAssignmentsPastEndDate(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.employeeBenefitRepo
      .createQueryBuilder()
      .update(EmployeeBenefit)
      .set({ status: "expired" })
      .where("status = :status", { status: "active" })
      .andWhere("end_date IS NOT NULL")
      .andWhere("end_date < :today", { today })
      .execute();
  }

  async findAll(
    tenant_id: string,
    employeeId: string,
    page: number = 1,
  ) {
    await this.expireAssignmentsPastEndDate();

    const qb = this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .leftJoinAndSelect("eb.employee", "employee")
      .leftJoinAndSelect("employee.user", "user")
      .leftJoinAndSelect("employee.designation", "designation")
      .leftJoinAndSelect("designation.department", "department")
      .leftJoinAndSelect("eb.benefit", "benefit")
      .where("user.tenant_id = :tenant_id", { tenant_id })
      .andWhere("employee.id = :employeeId", { employeeId });

    qb.orderBy("eb.createdAt", "DESC");
    const skip = (page - 1) * 25;
    qb.skip(skip).take(25);
    const results = await qb.getMany();

    // Group by employee, collect all their benefits into an array
    const employeeMap = new Map();
    for (const record of results) {
      const eid = record.employee?.id;
      if (!eid) continue;
      let empObj = employeeMap.get(eid);
      const benefitDetails = {
        id: record.benefit.id,
        name: record.benefit.name,
        description: record.benefit.description,
        type: record.benefit.type,
        eligibilityCriteria: record.benefit.eligibilityCriteria,
        status: record.benefit.status,
        tenant_id: record.benefit.tenant_id,
        createdBy: record.benefit.createdBy,
        createdAt: record.benefit.createdAt,
        // extra assignment attributes:
        statusOfAssignment: record.status,
        startDate: record.startDate,
        endDate: record.endDate,
        benefitAssignmentId: record.id,
        benefitCreatedAt: record.createdAt,
      };
      if (!empObj) {
        empObj = {
          employeeId: eid,
          employeeName: `${record.employee.user.first_name} ${record.employee.user.last_name}`,
          department: record.employee.designation.department.name,
          designation: record.employee.designation.title,
          benefits: [benefitDetails],
        };
        employeeMap.set(eid, empObj);
      } else {
        empObj.benefits.push(benefitDetails);
      }
    }
    return Array.from(employeeMap.values());
  }

  /**
   * Returns only benefit assignments eligible for reimbursement: active assignment + active benefit + not expired.
   * Use this for reimbursement form dropdown so employee cannot pick inactive/expired benefits.
   */
  async getEligibleForReimbursement(tenant_id: string, employeeId: string) {
    await this.expireAssignmentsPastEndDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list = await this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .leftJoinAndSelect("eb.benefit", "benefit")
      .leftJoinAndSelect("eb.employee", "employee")
      .leftJoinAndSelect("employee.user", "user")
      .where("eb.tenant_id = :tenant_id", { tenant_id })
      .andWhere("eb.employee_id = :employeeId", { employeeId })
      .andWhere("eb.status = :status", { status: "active" })
      .andWhere("benefit.status = :benefitStatus", { benefitStatus: "active" })
      .andWhere("(eb.end_date IS NULL OR eb.end_date >= :today)", { today })
      .orderBy("eb.createdAt", "DESC")
      .getMany();

    return list.map((eb) => ({
      benefitAssignmentId: eb.id,
      benefitId: eb.benefit.id,
      name: eb.benefit.name,
      type: eb.benefit.type,
      startDate: eb.startDate,
      endDate: eb.endDate,
    }));
  }

  async cancel(tenant_id: string, id: string) {
    const benefitRecord = await this.employeeBenefitRepo.findOne({
      where: { id, tenant_id },
    });

    if (!benefitRecord) {
      throw new NotFoundException("Employee benefit record not found");
    }

    if (benefitRecord.status === "cancelled") {
      throw new ConflictException("This benefit is already cancelled");
    }

    benefitRecord.status = "cancelled";

    return await this.employeeBenefitRepo.save(benefitRecord);
  }

  async getAllEmployeesWithBenefits(
    tenant_id: string,
    page: number = 1,
    limit: number = 25,
  ) {
    await this.expireAssignmentsPastEndDate();

    const qb = this.employeeRepo
      .createQueryBuilder("employee")
      .leftJoinAndSelect("employee.employeeBenefits", "eb")
      .leftJoinAndSelect("eb.benefit", "benefit")
      .innerJoinAndSelect("employee.user", "user")
      .innerJoinAndSelect("employee.designation", "designation")
      .innerJoinAndSelect("designation.department", "department")
      .where("user.tenant_id = :tenant_id", { tenant_id })
      .orderBy("employee.id", "ASC");

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [employees, total] = await qb.getManyAndCount();

    const data = employees.map((e) => ({
      employeeId: e.id,
      employeeName: `${e.user.first_name} ${e.user.last_name}`,
      department: e.designation?.department?.name,
      designation: e.designation?.title,
      benefits: e.employeeBenefits.map((b) => ({
        id: b.benefit.id,
        name: b.benefit.name,
        description: b.benefit.description,
        type: b.benefit.type,
        eligibilityCriteria: b.benefit.eligibilityCriteria,
        status: b.benefit.status,
        tenant_id: b.benefit.tenant_id,
        createdBy: b.benefit.createdBy,
        createdAt: b.benefit.createdAt,
        // Assignment details:
        benefitAssignmentId: b.id,
        statusOfAssignment: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
        assignedBy: b.assignedBy,
        benefitCreatedAt: b.createdAt,
      })),
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getSummary(tenant_id: string) {
    // Total Active Benefits
    const totalActiveBenefits = await this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .innerJoin("eb.benefit", "benefit")
      .where("eb.tenant_id = :tenant_id", { tenant_id })
      .andWhere("eb.status = :status", { status: "active" })
      .getCount();

    // Most Common Benefit Type (raw keys may be lowercase in PostgreSQL)
    const mostCommonRaw = await this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .innerJoin("eb.benefit", "benefit")
      .where("eb.tenant_id = :tenant_id", { tenant_id })
      .andWhere("eb.status = :status", { status: "active" })
      .select("benefit.name", "benefitName")
      .addSelect("COUNT(eb.id)", "count")
      .groupBy("benefit.name")
      .orderBy("count", "DESC")
      .limit(1)
      .getRawOne<{ benefitName?: string; benefitname?: string }>();

    const mostCommonBenefitType =
      mostCommonRaw?.benefitName ?? mostCommonRaw?.benefitname ?? null;

    // Total Employees Covered (raw key may be lowercase)
    const totalEmployeesCoveredRaw = await this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .where("eb.tenant_id = :tenant_id", { tenant_id })
      .andWhere("eb.status = :status", { status: "active" })
      .select("COUNT(DISTINCT eb.employee_id)", "count")
      .getRawOne<{ count?: string }>();

    const totalEmployeesCoveredCount = totalEmployeesCoveredRaw?.count;
    const totalEmployeesCovered = totalEmployeesCoveredCount
      ? parseInt(String(totalEmployeesCoveredCount), 10) || 0
      : 0;

    return {
      totalActiveBenefits,
      mostCommonBenefitType,
      totalEmployeesCovered,
    };
  }

  // System Admin Methods - Can view all tenants or filter by tenant_id
  async getSystemAdminSummary(tenant_id?: string) {
    // Total Active Benefits
    let totalActiveBenefitsQb = this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .innerJoin("eb.benefit", "benefit")
      .where("eb.status = :status", { status: "active" });

    if (tenant_id) {
      totalActiveBenefitsQb = totalActiveBenefitsQb.andWhere(
        "eb.tenant_id = :tenant_id",
        { tenant_id },
      );
    }

    const totalActiveBenefits = await totalActiveBenefitsQb.getCount();

    // Most Common Benefit Type
    let mostCommonQb = this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .innerJoin("eb.benefit", "benefit")
      .where("eb.status = :status", { status: "active" });

    if (tenant_id) {
      mostCommonQb = mostCommonQb.andWhere("eb.tenant_id = :tenant_id", {
        tenant_id,
      });
    }

    const mostCommonRaw = await mostCommonQb
      .select("benefit.name", "benefitName")
      .addSelect("COUNT(eb.id)", "count")
      .groupBy("benefit.name")
      .orderBy("count", "DESC")
      .limit(1)
      .getRawOne<{ benefitName?: string; benefitname?: string }>();

    const mostCommonBenefitType =
      mostCommonRaw?.benefitName ?? mostCommonRaw?.benefitname ?? null;

    // Total Employees Covered (raw key may be lowercase)
    let totalEmployeesCoveredQb = this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .where("eb.status = :status", { status: "active" });

    if (tenant_id) {
      totalEmployeesCoveredQb = totalEmployeesCoveredQb.andWhere(
        "eb.tenant_id = :tenant_id",
        { tenant_id },
      );
    }

    const totalEmployeesCoveredRaw = await totalEmployeesCoveredQb
      .select("COUNT(DISTINCT eb.employee_id)", "count")
      .getRawOne<{ count?: string }>();

    const totalEmployeesCoveredCount = totalEmployeesCoveredRaw?.count;
    const totalEmployeesCovered = totalEmployeesCoveredCount
      ? parseInt(String(totalEmployeesCoveredCount), 10) || 0
      : 0;

    return {
      tenant_id: tenant_id || "all",
      totalActiveBenefits,
      mostCommonBenefitType,
      totalEmployeesCovered,
    };
  }

  /**
   * Get all employees with benefits across all tenants (for system admin)
   * @param tenantId - Optional tenant ID to filter by
   * @param departmentId - Optional department ID to filter employees by department
   * @param designationId - Optional designation ID to filter employees by designation
   * @returns Employees grouped by tenant with all their benefits
   */
  async getAllEmployeesWithBenefitsAcrossTenants(
    tenantId?: string,
    page: number = 1,
    limit: number = 25,
    departmentId?: string,
    designationId?: string,
  ): Promise<{
    items: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_status: string;
      employees: Array<{
        employeeId: string;
        employeeName: string;
        email: string;
        profile_pic: string | null;
        department: string | null;
        designation: string | null;
        benefits: Array<{
          id: string;
          name: string;
          description: string | null;
          type: string;
          eligibilityCriteria: string | null;
          status: string;
          tenant_id: string;
          createdBy: string;
          createdAt: Date;
          benefitAssignmentId: string;
          statusOfAssignment: string;
          startDate: Date;
          endDate: Date | null;
          assignedBy: string;
          benefitCreatedAt: Date;
        }>;
      }>;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    await this.expireAssignmentsPastEndDate();

    const toLowerStrict = (value: string): string => value.toLowerCase();
    const toLowerOrNull = (value: string | null | undefined): string | null =>
      typeof value === 'string' ? value.toLowerCase() : null;

    // Build tenant filter
    const tenantWhere: any = { deleted_at: IsNull() };
    if (tenantId) {
      tenantWhere.id = tenantId;
    }

    const skip = (page - 1) * limit;

    // When no tenant_id: return ALL tenants with their employees (no pagination). When tenant_id provided: single tenant.
    const [tenants, total] =
      tenantId
        ? await this.tenantRepo.findAndCount({
            where: tenantWhere,
            order: { name: 'ASC' },
            skip,
            take: limit,
          })
        : await this.tenantRepo.findAndCount({
            where: tenantWhere,
            order: { name: 'ASC' },
          });

    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length === 0) {
      const totalPages = Math.ceil(total / limit) || 1;
      return {
        items: [],
        total,
        page,
        limit,
        totalPages,
      };
    }

    // Single query: all employees for this page's tenants (user.tenant_id IN (...))
    const empQb = this.employeeRepo
      .createQueryBuilder("employee")
      .leftJoinAndSelect("employee.employeeBenefits", "eb")
      .leftJoinAndSelect("eb.benefit", "benefit")
      .innerJoinAndSelect("employee.user", "user")
      .innerJoinAndSelect("employee.designation", "designation")
      .leftJoinAndSelect("designation.department", "department")
      .where("user.tenant_id IN (:...tenantIds)", { tenantIds });

    if (departmentId) {
      empQb.andWhere("designation.department_id = :departmentId", { departmentId });
    }
    if (designationId) {
      empQb.andWhere("employee.designation_id = :designationId", { designationId });
    }

    const allEmployees = await empQb
      .orderBy("user.tenant_id", "ASC")
      .addOrderBy("employee.id", "ASC")
      .getMany();

    const employeesByTenantId = new Map<string, typeof allEmployees>();
    for (const emp of allEmployees) {
      const tid = emp.user?.tenant_id;
      if (!tid) continue;
      if (!employeesByTenantId.has(tid)) employeesByTenantId.set(tid, []);
      employeesByTenantId.get(tid)!.push(emp);
    }

    const result: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_status: string;
      employees: Array<{
        employeeId: string;
        employeeName: string;
        email: string;
        profile_pic: string | null;
        department: string | null;
        designation: string | null;
        benefits: Array<{
          id: string;
          name: string;
          description: string | null;
          type: string;
          eligibilityCriteria: string | null;
          status: string;
          tenant_id: string;
          createdBy: string;
          createdAt: Date;
          benefitAssignmentId: string;
          statusOfAssignment: string;
          startDate: Date;
          endDate: Date | null;
          assignedBy: string;
          benefitCreatedAt: Date;
        }>;
      }>;
    }> = [];

    const transformEmployee = (e: (typeof allEmployees)[0]) => ({
      employeeId: e.id,
      employeeName: toLowerStrict(`${e.user?.first_name ?? ""} ${e.user?.last_name ?? ""}`),
      email: toLowerStrict(e.user?.email ?? ""),
      profile_pic: e.user?.profile_pic ?? null,
      department: toLowerOrNull(e.designation?.department?.name),
      designation: toLowerOrNull(e.designation?.title),
      benefits: (e.employeeBenefits || []).map((b) => ({
        id: b.benefit?.id ?? b.benefitId,
        name: toLowerStrict(b.benefit?.name ?? ""),
        description: toLowerOrNull(b.benefit?.description),
        type: toLowerStrict(b.benefit?.type ?? ""),
        eligibilityCriteria: toLowerOrNull(b.benefit?.eligibilityCriteria),
        status: toLowerStrict(b.benefit?.status ?? ""),
        tenant_id: b.benefit?.tenant_id ?? b.tenant_id,
        createdBy: b.benefit?.createdBy ?? "",
        createdAt: b.benefit?.createdAt ?? b.createdAt,
        benefitAssignmentId: b.id,
        statusOfAssignment: toLowerStrict(b.status),
        startDate: b.startDate,
        endDate: b.endDate,
        assignedBy: b.assignedBy,
        benefitCreatedAt: b.createdAt,
      })),
    });

    for (const tenant of tenants) {
      const employees = employeesByTenantId.get(tenant.id) ?? [];
      result.push({
        tenant_id: tenant.id,
        tenant_name: toLowerStrict(tenant.name),
        tenant_status: toLowerStrict(tenant.status),
        employees: employees.map(transformEmployee),
      });
    }

    const totalPages = tenantId ? Math.ceil(total / limit) || 1 : 1;
    const effectiveLimit = tenantId ? limit : result.length;

    return {
      items: result,
      total,
      page: tenantId ? page : 1,
      limit: effectiveLimit,
      totalPages,
    };
  }

  /**
   * Get all employees with benefits across tenants for export (system admin).
   * Same filters as getAllEmployeesWithBenefitsAcrossTenants; no pagination.
   * @returns Flat rows for CSV: one row per benefit assignment
   */
  async getAllEmployeesWithBenefitsAcrossTenantsForExport(
    tenantId?: string,
    departmentId?: string,
    designationId?: string,
  ): Promise<
    Array<{
      tenant_name: string;
      employee_name: string;
      email: string;
      department: string;
      designation: string;
      benefit_name: string;
      benefit_type: string;
      benefit_status: string;
      assignment_status: string;
      start_date: string;
      end_date: string;
    }>
  > {
    await this.expireAssignmentsPastEndDate();

    const tenantWhere: any = { deleted_at: IsNull() };
    if (tenantId) tenantWhere.id = tenantId;

    const tenants = await this.tenantRepo.find({
      where: tenantWhere,
      order: { name: "ASC" },
    });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length === 0) return [];

    const empQb = this.employeeRepo
      .createQueryBuilder("employee")
      .leftJoinAndSelect("employee.employeeBenefits", "eb")
      .leftJoinAndSelect("eb.benefit", "benefit")
      .innerJoinAndSelect("employee.user", "user")
      .innerJoinAndSelect("employee.designation", "designation")
      .leftJoinAndSelect("designation.department", "department")
      .where("user.tenant_id IN (:...tenantIds)", { tenantIds });

    if (departmentId) {
      empQb.andWhere("designation.department_id = :departmentId", { departmentId });
    }
    if (designationId) {
      empQb.andWhere("employee.designation_id = :designationId", { designationId });
    }

    const employees = await empQb
      .orderBy("user.tenant_id", "ASC")
      .addOrderBy("employee.id", "ASC")
      .getMany();

    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
    const rows: Array<{
      tenant_name: string;
      employee_name: string;
      email: string;
      department: string;
      designation: string;
      benefit_name: string;
      benefit_type: string;
      benefit_status: string;
      assignment_status: string;
      start_date: string;
      end_date: string;
    }> = [];

    for (const emp of employees) {
      const tenantName = (emp.user?.tenant_id && tenantMap.get(emp.user.tenant_id)) || "";
      const employeeName = [emp.user?.first_name, emp.user?.last_name].filter(Boolean).join(" ").trim() || "";
      const email = emp.user?.email ?? "";
      const department = emp.designation?.department?.name ?? "";
      const designation = emp.designation?.title ?? "";

      const benefits = emp.employeeBenefits || [];
      if (benefits.length === 0) {
        rows.push({
          tenant_name: tenantName,
          employee_name: employeeName,
          email,
          department,
          designation,
          benefit_name: "",
          benefit_type: "",
          benefit_status: "",
          assignment_status: "",
          start_date: "",
          end_date: "",
        });
      } else {
        for (const b of benefits) {
          rows.push({
            tenant_name: tenantName,
            employee_name: employeeName,
            email,
            department,
            designation,
            benefit_name: b.benefit?.name ?? "",
            benefit_type: b.benefit?.type ?? "",
            benefit_status: b.benefit?.status ?? "",
            assignment_status: b.status ?? "",
            start_date: b.startDate ? new Date(b.startDate).toISOString().split("T")[0] : "",
            end_date: b.endDate ? new Date(b.endDate).toISOString().split("T")[0] : "",
          });
        }
      }
    }

    return rows;
  }

}
