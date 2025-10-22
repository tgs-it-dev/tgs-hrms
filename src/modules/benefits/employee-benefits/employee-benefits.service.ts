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
    filters?: {
      employeeId?: string;
      department?: string;
      designation?: string;
    },
    page: number = 1,
  ) {
    const qb = this.employeeBenefitRepo
      .createQueryBuilder("eb")
      .leftJoinAndSelect("eb.employee", "employee")
      .leftJoinAndSelect("employee.user", "user")
      .leftJoinAndSelect("employee.designation", "designation")
      .leftJoinAndSelect("designation.department", "department")
      .leftJoinAndSelect("eb.benefit", "benefit")
      .where("user.tenant_id = :tenant_id", { tenant_id });

    if (filters?.employeeId) {
      qb.andWhere("employee.id = :employeeId", {
        employeeId: filters.employeeId,
      });
    }

    if (filters?.department) {
      qb.andWhere("department.name = :department", {
        department: filters.department,
      });
    }

    if (filters?.designation) {
      qb.andWhere("designation.title = :designation", {
        designation: filters.designation,
      });
    }

    qb.orderBy("eb.createdAt", "DESC");

    const skip = (page - 1) * 25;
    qb.skip(skip).take(25);

    const results = await qb.getMany();

    const data = results.map((record) => ({
      id: record.id,
      employeeId: record.employee?.id,
      employeeName: `${record.employee.user.first_name} ${record.employee.user.last_name}`,
      department: record.employee.designation.department.name,
      designation: record.employee.designation.title,
      benefit: record.benefit,
      status: record.status,
      startDate: record.startDate,
      endDate: record.endDate,
      createdAt: record.createdAt,
    }));

    return data;
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
        status: b.status,
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
}
