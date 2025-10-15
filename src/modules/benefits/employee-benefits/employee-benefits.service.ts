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

  async findAllByEmployee(tenant_id: string, employeeId: string) {
    const employee = await this.employeeRepo
      .createQueryBuilder("employee")
      .innerJoin("employee.user", "user")
      .where("employee.id = :employeeId", { employeeId })
      .andWhere("user.tenant_id = :tenantId", { tenantId: tenant_id })
      .getOne();

    if (!employee) {
      throw new NotFoundException("Employee not found for this tenant");
    }

    return await this.employeeBenefitRepo.find({
      where: { employeeId, tenant_id },
      relations: ["benefit"],
      order: { createdAt: "DESC" },
    });
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
}
