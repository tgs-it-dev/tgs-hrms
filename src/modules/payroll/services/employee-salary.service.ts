import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { EmployeeSalary } from '../../../entities/employee-salary.entity';
import { Employee } from '../../../entities/employee.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { CreateEmployeeSalaryDto, UpdateEmployeeSalaryDto } from '../dto/employee-salary.dto';
import { EmployeeStatus } from '../../../common/constants/enums';

@Injectable()
export class EmployeeSalaryService {
  constructor(
    @InjectRepository(EmployeeSalary)
    private readonly employeeSalaryRepo: Repository<EmployeeSalary>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateEmployeeSalaryDto): Promise<EmployeeSalary> {
    // Validate employee exists and belongs to tenant
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

    // Check if there's an active salary for this employee
    const existingActiveSalary = await this.employeeSalaryRepo.findOne({
      where: {
        employee_id: dto.employee_id,
        tenant_id: tenantId,
        status: 'active',
      },
    });

    if (existingActiveSalary) {
      // Deactivate the existing salary
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

  async getByEmployeeId(employeeId: string, tenantId: string): Promise<EmployeeSalary | null> {
    const salary = await this.employeeSalaryRepo.findOne({
      where: {
        employee_id: employeeId,
        tenant_id: tenantId,
        status: 'active',
      },
      relations: ['employee', 'employee.user'],
    });

    return salary;
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

    // Update only provided fields
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
}

