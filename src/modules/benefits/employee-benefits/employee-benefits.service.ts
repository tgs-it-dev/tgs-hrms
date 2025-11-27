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
import { Repository, QueryFailedError } from "typeorm";
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
  ) {}

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

  async findAll(
    tenant_id: string,
    employeeId: string,
    page: number = 1,
  ) {
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

  async getAllEmployeesWithBenefits(tenant_id: string, page: number = 1) {
    const qb = this.employeeRepo
      .createQueryBuilder("employee")
      .leftJoinAndSelect("employee.employeeBenefits", "eb")
      .leftJoinAndSelect("eb.benefit", "benefit")
      .innerJoinAndSelect("employee.user", "user")
      .innerJoinAndSelect("employee.designation", "designation")
      .innerJoinAndSelect("designation.department", "department")
      .where("user.tenant_id = :tenant_id", { tenant_id })
      .orderBy("employee.id", "ASC");

    const skip = (page - 1) * 25;
    qb.skip(skip).take(25);

    const employees = await qb.getMany();

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
        benefitAssignmentId: b.id,  // ← This is what you need for cancellation!
        statusOfAssignment: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
        assignedBy: b.assignedBy,
        benefitCreatedAt: b.createdAt,
      })),
    }));

    return data;
  }

  async getSummary(tenant_id: string) {
    // Total Active Benefits
    const totalActiveBenefits = await this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .innerJoin("eb.benefit", "benefit")
      .where("eb.tenant_id = :tenant_id", { tenant_id })
      .andWhere("eb.status = :status", { status: "active" })
      .getCount();

    // Most Common Benefit Type
    const mostCommon: { benefitName: string } | null | undefined =
      await this.employeeBenefitRepo
        .createQueryBuilder("eb")
        .innerJoin("eb.benefit", "benefit")
        .where("eb.tenant_id = :tenant_id", { tenant_id })
        .select("benefit.name", "benefitName")
        .addSelect("COUNT(eb.id)", "count")
        .groupBy("benefit.name")
        .orderBy("count", "DESC")
        .limit(1)
        .getRawOne();

    // Total Employees Covered
    const totalEmployeesCovered: { count: string } | null | undefined =
      await this.employeeBenefitRepo
        .createQueryBuilder("eb")
        .where("eb.tenant_id = :tenant_id", { tenant_id })
        .andWhere("eb.status = :status", { status: "active" })
        .select("COUNT(DISTINCT eb.employee_id)", "count")
        .getRawOne();

    return {
      totalActiveBenefits,
      mostCommonBenefitType: mostCommon?.benefitName ?? null,
      totalEmployeesCovered: totalEmployeesCovered
        ? parseInt(totalEmployeesCovered.count, 10) || 0
        : 0,
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

    const mostCommon: { benefitName: string } | null | undefined =
      await mostCommonQb
        .select("benefit.name", "benefitName")
        .addSelect("COUNT(eb.id)", "count")
        .groupBy("benefit.name")
        .orderBy("count", "DESC")
        .limit(1)
        .getRawOne();

    // Total Employees Covered
    let totalEmployeesCoveredQb = this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .where("eb.status = :status", { status: "active" });

    if (tenant_id) {
      totalEmployeesCoveredQb = totalEmployeesCoveredQb.andWhere(
        "eb.tenant_id = :tenant_id",
        { tenant_id },
      );
    }

    const totalEmployeesCovered: { count: string } | null | undefined =
      await totalEmployeesCoveredQb
        .select("COUNT(DISTINCT eb.employee_id)", "count")
        .getRawOne();

    return {
      tenant_id: tenant_id || "all",
      totalActiveBenefits,
      mostCommonBenefitType: mostCommon?.benefitName ?? null,
      totalEmployeesCovered: totalEmployeesCovered
        ? parseInt(totalEmployeesCovered.count, 10) || 0
        : 0,
    };
  }

  /**
   * Get all employees with benefits across all tenants (for system admin)
   * @param tenantId - Optional tenant ID to filter by
   * @returns Employees grouped by tenant with all their benefits
   */
  async getAllEmployeesWithBenefitsAcrossTenants(tenantId?: string): Promise<{
    tenants: Array<{
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
  }> {
    // Get tenants (filter by tenantId if provided)
    const tenantWhere: any = { isDeleted: false };
    if (tenantId) {
      tenantWhere.id = tenantId;
    }

    const tenants = await this.tenantRepo.find({
      where: tenantWhere,
      order: { name: 'ASC' },
    });

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

    for (const tenant of tenants) {
      // Get all employees with their benefits for this tenant
      const employees = await this.employeeRepo
        .createQueryBuilder("employee")
        .leftJoinAndSelect("employee.employeeBenefits", "eb")
        .leftJoinAndSelect("eb.benefit", "benefit")
        .innerJoinAndSelect("employee.user", "user")
        .innerJoinAndSelect("employee.designation", "designation")
        .leftJoinAndSelect("designation.department", "department")
        .where("user.tenant_id = :tenant_id", { tenant_id: tenant.id })
        .orderBy("employee.id", "ASC")
        .getMany();

      // Transform employees data
      const transformedEmployees = employees.map((e) => ({
        employeeId: e.id,
        employeeName: `${e.user.first_name} ${e.user.last_name}`,
        email: e.user.email,
        profile_pic: e.user.profile_pic,
        department: e.designation?.department?.name || null,
        designation: e.designation?.title || null,
        benefits: (e.employeeBenefits || []).map((b) => ({
          id: b.benefit.id,
          name: b.benefit.name,
          description: b.benefit.description,
          type: b.benefit.type,
          eligibilityCriteria: b.benefit.eligibilityCriteria,
          status: b.benefit.status,
          tenant_id: b.benefit.tenant_id,
          createdBy: b.benefit.createdBy,
          createdAt: b.benefit.createdAt,
          benefitAssignmentId: b.id,
          statusOfAssignment: b.status,
          startDate: b.startDate,
          endDate: b.endDate,
          assignedBy: b.assignedBy,
          benefitCreatedAt: b.createdAt,
        })),
      }));

      result.push({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_status: tenant.status,
        employees: transformedEmployees,
      });
    }

    return { tenants: result };
  }

}
