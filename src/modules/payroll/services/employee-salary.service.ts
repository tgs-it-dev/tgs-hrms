import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EmployeeSalary } from '../../../entities/employee-salary.entity';
import { Employee } from '../../../entities/employee.entity';
import { CreateEmployeeSalaryDto, UpdateEmployeeSalaryDto, AllowanceItemDto, DeductionItemDto } from '../dto/employee-salary.dto';
import { EmployeeStatus } from '../../../common/constants/enums';
import { PaginationResponse } from '../../../common/interfaces/pagination.interface';
import { PayrollConfigService } from './payroll-config.service';
import { PayrollConfig } from '../../../entities/payroll-config.entity';

@Injectable()
export class EmployeeSalaryService {
  constructor(
    @InjectRepository(EmployeeSalary)
    private readonly employeeSalaryRepo: Repository<EmployeeSalary>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly payrollConfigService: PayrollConfigService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateEmployeeSalaryDto): Promise<EmployeeSalary> {
    const employee = await this.employeeRepo.findOne({
      where: { id: dto.employee_id },
      relations: ['user'],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.user.tenant_id !== tenantId) {
      throw new ForbiddenException('Employee does not belong to your organization');
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException('Can only assign salary to active employees');
    }

    // Close any existing active salary record for this employee
    const existingActiveSalary = await this.employeeSalaryRepo.findOne({
      where: {
        employee_id: dto.employee_id,
        tenant_id: tenantId,
        status: 'active',
      },
    });

    if (existingActiveSalary) {
      existingActiveSalary.status = 'inactive';
      existingActiveSalary.endDate = new Date(dto.effectiveDate);
      existingActiveSalary.updated_by = userId;
      await this.employeeSalaryRepo.save(existingActiveSalary);
    }

    const salary = this.employeeSalaryRepo.create({
      tenant_id: tenantId,
      employee_id: dto.employee_id,
      baseSalary: dto.baseSalary,
      allowances: dto.allowances || null,
      deductions: dto.deductions || null,
      effectiveDate: new Date(dto.effectiveDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      status: dto.status || 'active',
      notes: dto.notes || null,
      created_by: userId,
    });

    return await this.employeeSalaryRepo.save(salary);
  }

  async getByEmployeeId(
    employeeId: string,
    tenantId: string,
  ): Promise<{
    salary: EmployeeSalary | null;
    defaults: {
      baseSalary: number;
      allowances: AllowanceItemDto[];
      deductions: DeductionItemDto[];
    };
  }> {
    const salary = await this.employeeSalaryRepo.findOne({
      where: {
        employee_id: employeeId,
        tenant_id: tenantId,
        status: 'active',
      },
      relations: ['employee', 'employee.user'],
    });

    const defaults = await this.getSalaryTemplateForTenant(tenantId);

    return { salary, defaults };
  }

  async getSalaryHistory(employeeId: string, tenantId: string): Promise<EmployeeSalary[]> {
    return await this.employeeSalaryRepo.find({
      where: {
        employee_id: employeeId,
        tenant_id: tenantId,
      },
      relations: ['employee', 'employee.user'],
      order: { effectiveDate: 'DESC' },
    });
  }

  async update(employeeId: string, tenantId: string, userId: string, dto: UpdateEmployeeSalaryDto): Promise<EmployeeSalary> {
    const salary = await this.employeeSalaryRepo.findOne({
      where: {
        employee_id: employeeId,
        tenant_id: tenantId,
        status: 'active',
      },
    });

    if (!salary) {
      throw new NotFoundException('Active salary not found for this employee');
    }

    
    if (dto.baseSalary !== undefined) salary.baseSalary = dto.baseSalary;
    if (dto.allowances !== undefined) salary.allowances = dto.allowances;
    if (dto.deductions !== undefined) salary.deductions = dto.deductions;
    if (dto.effectiveDate !== undefined) salary.effectiveDate = new Date(dto.effectiveDate);
    if (dto.endDate !== undefined) salary.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.status !== undefined) salary.status = dto.status;
    if (dto.notes !== undefined) salary.notes = dto.notes;

    salary.updated_by = userId;

    return await this.employeeSalaryRepo.save(salary);
  }

  async getActiveSalaryForDate(employeeId: string, tenantId: string, date: Date): Promise<EmployeeSalary | null> {
    return await this.employeeSalaryRepo
      .createQueryBuilder('salary')
      .where('salary.employee_id = :employeeId', { employeeId })
      .andWhere('salary.tenant_id = :tenantId', { tenantId })
      .andWhere('salary.effectiveDate <= :date', { date })
      .andWhere('(salary.endDate IS NULL OR salary.endDate >= :date)', { date })
      .andWhere('salary.status = :status', { status: 'active' })
      .orderBy('salary.effectiveDate', 'DESC')
      .getOne();
  }

  async getAllEmployeeSalaries(tenantId: string, page: number = 1, limit: number = 25): Promise<PaginationResponse<any>> {
    const skip = (page - 1) * limit;
    
    const [employees, total] = await this.employeeRepo
      .createQueryBuilder('employee')
      .innerJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .leftJoinAndSelect('employee.team', 'team')
      .where('user.tenant_id = :tenantId', { tenantId })
      .orderBy('employee.created_at', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const employeeIds = employees.map((e) => e.id);

    
    const salaries = employeeIds.length > 0
      ? await this.employeeSalaryRepo.find({
          where: {
            employee_id: In(employeeIds),
            tenant_id: tenantId,
            status: 'active',
          },
          relations: ['employee'],
        })
      : [];

    
    const salaryMap = new Map<string, EmployeeSalary>();
    salaries.forEach((salary) => {
      salaryMap.set(salary.employee_id, salary);
    });

    
    const items = employees.map((employee) => {
      const salary = salaryMap.get(employee.id);
      return {
        employee: {
          id: employee.id,
          user: {
            id: employee.user.id,
            first_name: employee.user.first_name,
            last_name: employee.user.last_name,
            email: employee.user.email,
            profile_pic: employee.user.profile_pic,
          },
          designation: employee.designation
            ? {
                id: employee.designation.id,
                title: employee.designation.title,
              }
            : null,
          department: employee.designation?.department
            ? {
                id: employee.designation.department.id,
                name: employee.designation.department.name,
              }
            : null,
          team: employee.team
            ? {
                id: employee.team.id,
                name: employee.team.name,
              }
            : null,
          status: employee.status,
        },
        salary: salary
          ? {
              id: salary.id,
              baseSalary: salary.baseSalary,
              allowances: salary.allowances,
              deductions: salary.deductions,
              effectiveDate: salary.effectiveDate,
              endDate: salary.endDate,
              status: salary.status,
              notes: salary.notes,
            }
          : null,
      };
    });

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
   * Returns a default salary structure template for the tenant
   * based on the tenant's payroll configuration. This is intended
   * to be used by the UI to pre-fill employee salary structures.
   *
   * Behaviour:
   * - All values are only defaults for the UI.
   * - When creating/updating an employee salary, ONLY the allowances
   *   and deductions actually sent in the DTO will be stored.
   *   If some allowance/deduction exists in payroll config but is
   *   not sent for a particular employee, it is treated as
   *   "not applicable" for that employee.
   */
  async getSalaryTemplateForTenant(
    tenantId: string,
  ): Promise<{
    baseSalary: number;
    allowances: AllowanceItemDto[];
    deductions: DeductionItemDto[];
  }> {
    let config: PayrollConfig | null = null;

    try {
      config = await this.payrollConfigService.getByTenantId(tenantId);
    } catch {
      // If tenant has no config yet, fall back to global defaults
      const defaultConfig = await this.payrollConfigService.getDefaultConfig();
      return {
        baseSalary: defaultConfig.basePayComponents?.basic ?? 0,
        allowances: (defaultConfig.allowances || []).map((a: any) => ({
          type: a.type,
          amount: a.amount,
          percentage: a.percentage,
          description: a.description,
        })),
        // coalesce to null to satisfy strict typing
        deductions: this.mapConfigDeductionsToSalaryItems(defaultConfig.deductions || null),
      };
    }

    return {
      baseSalary: config.basePayComponents?.basic ?? 0,
      allowances: (config.allowances || []).map((a: any) => ({
        type: a.type,
        amount: a.amount,
        percentage: a.percentage,
        description: a.description,
      })),
      // coalesce to null to satisfy strict typing
      deductions: this.mapConfigDeductionsToSalaryItems(config.deductions || null),
    };
  }

  /**
   * Maps the payroll config's percentage-based deductions object
   * to the per-employee salary deductions array structure.
   * These are only defaults – HR can remove/override them per employee.
   */
  private mapConfigDeductionsToSalaryItems(
    configDeductions: PayrollConfig['deductions'] | null,
  ): DeductionItemDto[] {
    if (!configDeductions) return [];

    const items: DeductionItemDto[] = [];

    if (configDeductions.taxPercentage !== undefined) {
      items.push({
        type: 'tax',
        percentage: configDeductions.taxPercentage,
      });
    }

    if (configDeductions.insurancePercentage !== undefined) {
      items.push({
        type: 'insurance',
        percentage: configDeductions.insurancePercentage,
      });
    }

    if (configDeductions.providentFundPercentage !== undefined) {
      items.push({
        type: 'provident_fund',
        percentage: configDeductions.providentFundPercentage,
      });
    }

    return items;
  }
}
