import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { PayrollRecord } from '../../../entities/payroll-record.entity';
import { PayrollConfig } from '../../../entities/payroll-config.entity';
import { EmployeeSalary } from '../../../entities/employee-salary.entity';
import { Employee } from '../../../entities/employee.entity';
import { Attendance } from '../../../entities/attendance.entity';
import { Leave } from '../../../entities/leave.entity';
import { EmployeeKpi } from '../../../entities/employee-kpi.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { GeneratePayrollDto, UpdatePayrollStatusDto } from '../dto/payroll-record.dto';
import { PayrollConfigService } from './payroll-config.service';
import { EmployeeSalaryService } from './employee-salary.service';
import { AttendanceType, LeaveStatus, PayrollStatus } from '../../../common/constants/enums';
import { PaginationResponse } from '../../../common/interfaces/pagination.interface';

@Injectable()
export class PayrollRecordService {
  private readonly logger = new Logger(PayrollRecordService.name);

  constructor(
    @InjectRepository(PayrollRecord)
    private readonly payrollRecordRepo: Repository<PayrollRecord>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
    @InjectRepository(EmployeeKpi)
    private readonly employeeKpiRepo: Repository<EmployeeKpi>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly payrollConfigService: PayrollConfigService,
    private readonly employeeSalaryService: EmployeeSalaryService,
  ) {}

  async generatePayroll(tenantId: string, userId: string, dto: GeneratePayrollDto): Promise<PayrollRecord | PayrollRecord[]> {
    const { month, year, employee_id } = dto;

    // Validate month and year
    if (month < 1 || month > 12) {
      throw new BadRequestException('Invalid month. Must be between 1 and 12');
    }

    // Get payroll config
    let payrollConfig: PayrollConfig;
    try {
      payrollConfig = await this.payrollConfigService.getByTenantId(tenantId);
    } catch (error) {
      // Use default config if not found
      const defaultConfig = await this.payrollConfigService.getDefaultConfig();
      payrollConfig = {
        tenant_id: tenantId,
        salaryCycle: defaultConfig.salaryCycle as any,
        basePayComponents: defaultConfig.basePayComponents,
        allowances: defaultConfig.allowances,
        deductions: defaultConfig.deductions,
        overtimePolicy: defaultConfig.overtimePolicy,
        leaveDeductionPolicy: defaultConfig.leaveDeductionPolicy,
      } as PayrollConfig;
    }

    // Check if payroll already exists for this month/year
    const existingPayroll = await this.payrollRecordRepo.findOne({
      where: {
        tenant_id: tenantId,
        month,
        year,
        ...(employee_id ? { employee_id } : {}),
      },
    });

    if (existingPayroll && employee_id) {
      throw new BadRequestException(`Payroll already generated for employee ${employee_id} for ${month}/${year}`);
    }

    if (employee_id) {
      // Generate for single employee
      return await this.generateEmployeePayroll(tenantId, userId, employee_id, month, year, payrollConfig);
    } else {
      // Generate for all active employees
      const employees = await this.employeeRepo
        .createQueryBuilder('employee')
        .leftJoinAndSelect('employee.user', 'user')
        .where('user.tenant_id = :tenantId', { tenantId })
        .andWhere('employee.status = :status', { status: 'active' })
        .getMany();

      const payrollRecords: PayrollRecord[] = [];
      for (const employee of employees) {
        try {
          const record = await this.generateEmployeePayroll(
            tenantId,
            userId,
            employee.id,
            month,
            year,
            payrollConfig,
          );
          payrollRecords.push(record);
        } catch (error) {
          // Log error but continue with other employees
          this.logger.error(
            `Error generating payroll for employee ${employee.id}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      return payrollRecords;
    }
  }

  private async generateEmployeePayroll(
    tenantId: string,
    userId: string,
    employeeId: string,
    month: number,
    year: number,
    payrollConfig: PayrollConfig,
  ): Promise<PayrollRecord> {
    // Get employee
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
      relations: ['user'],
    });

    if (!employee || employee.user.tenant_id !== tenantId) {
      throw new NotFoundException('Employee not found');
    }

    // Get active salary for the month
    const monthStart = new Date(year, month - 1, 1);
    const salary = await this.employeeSalaryService.getActiveSalaryForDate(employeeId, tenantId, monthStart);

    if (!salary) {
      throw new NotFoundException(`No active salary found for employee ${employeeId} for ${month}/${year}`);
    }

    // Calculate working days
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const { workingDays, daysPresent, daysAbsent } = await this.calculateAttendance(
      employee.user_id,
      monthStart,
      monthEnd,
    );

    // Calculate leaves
    const { paidLeaves, unpaidLeaves } = await this.calculateLeaves(
      employee.user_id,
      tenantId,
      monthStart,
      monthEnd,
    );

    // Calculate overtime
    const overtimeHours = await this.calculateOvertime(
      employee.user_id,
      monthStart,
      monthEnd,
    );

    // Calculate gross salary
    const grossSalary = await this.calculateGrossSalary(
      salary,
      payrollConfig,
      workingDays,
      daysPresent,
      paidLeaves,
      unpaidLeaves,
    );

    // Calculate deductions
    const deductionsBreakdown = await this.calculateDeductions(
      grossSalary,
      payrollConfig,
      salary,
      unpaidLeaves,
      workingDays,
    );

    // Calculate bonuses
    const bonusesBreakdown = await this.calculateBonuses(
      employeeId,
      tenantId,
      grossSalary,
      overtimeHours,
      payrollConfig,
      month,
      year,
    );

    const totalDeductions: number = (Object.values(deductionsBreakdown) as any[]).reduce((sum: number, val: any) => {
      if (typeof val === 'number') return sum + val;
      if (Array.isArray(val)) {
        return sum + val.reduce((s: number, item: any) => s + (item.amount || 0), 0);
      }
      return sum;
    }, 0);

    const bonuses: number = (Object.values(bonusesBreakdown) as any[]).reduce((sum: number, val: any) => {
      if (typeof val === 'number') return sum + val;
      if (Array.isArray(val)) {
        return sum + val.reduce((s: number, item: any) => s + (item.amount || 0), 0);
      }
      return sum;
    }, 0);

    const netSalary = grossSalary - totalDeductions + bonuses;

    // Create payroll record
    const payrollRecord = this.payrollRecordRepo.create({
      tenant_id: tenantId,
      employee_id: employeeId,
      month,
      year,
      grossSalary,
      salaryBreakdown: {
        baseSalary: salary.baseSalary,
        allowances: salary.allowances || [],
        totalAllowances: this.calculateTotalAllowances(salary),
      },
      totalDeductions,
      deductionsBreakdown,
      bonuses,
      bonusesBreakdown,
      netSalary,
      workingDays,
      daysPresent,
      daysAbsent,
      paidLeaves,
      unpaidLeaves,
      overtimeHours,
      generated_by: userId,
      status: PayrollStatus.PENDING,
    });

    return await this.payrollRecordRepo.save(payrollRecord);
  }

  private async calculateAttendance(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ workingDays: number; daysPresent: number; daysAbsent: number }> {
    // Get all check-ins and check-outs in the month
    const attendances = await this.attendanceRepo.find({
      where: {
        user_id: userId,
        timestamp: Between(startDate, endDate),
        type: In([AttendanceType.CHECK_IN, AttendanceType.CHECK_OUT]),
      },
      order: { timestamp: 'ASC' },
    });

    // Group by date
    const dailyAttendance: Record<string, { checkIn?: Date; checkOut?: Date }> = {};
    const checkIns = attendances.filter((a) => a.type === AttendanceType.CHECK_IN);
    const checkOuts = attendances.filter((a) => a.type === AttendanceType.CHECK_OUT);

    for (const checkIn of checkIns) {
      const date = checkIn.timestamp.toISOString().split('T')[0];
      if (!date) continue;
      if (!dailyAttendance[date]) {
        dailyAttendance[date] = {};
      }
      dailyAttendance[date].checkIn = checkIn.timestamp;
    }

    for (const checkOut of checkOuts) {
      const date = checkOut.timestamp.toISOString().split('T')[0];
      if (!date) continue;
      if (!dailyAttendance[date]) {
        dailyAttendance[date] = {};
      }
      dailyAttendance[date].checkOut = checkOut.timestamp;
    }

    const daysPresent = Object.values(dailyAttendance).filter(
      (day) => day.checkIn && day.checkOut,
    ).length;

    // Calculate working days (excluding weekends)
    let workingDays = 0;
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday or Saturday
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const leaveDays = await this.getLeaveDaysCount(userId, startDate, endDate);
    const daysAbsent = Math.max(0, workingDays - daysPresent - leaveDays);

    return {
      workingDays,
      daysPresent,
      daysAbsent: Math.max(0, daysAbsent),
    };
  }

  private async getLeaveDaysCount(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const leaves = await this.leaveRepo.find({
      where: {
        employeeId: userId,
        status: LeaveStatus.APPROVED,
        startDate: Between(startDate, endDate),
      },
    });

    let totalDays = 0;
    for (const leave of leaves) {
      if (leave.startDate >= startDate && leave.endDate <= endDate) {
        totalDays += leave.totalDays;
      } else {
        // Partial overlap
        const overlapStart = leave.startDate > startDate ? leave.startDate : startDate;
        const overlapEnd = leave.endDate < endDate ? leave.endDate : endDate;
        const overlapDays = Math.floor(
          (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
        totalDays += overlapDays;
      }
    }

    return totalDays;
  }

  private async calculateLeaves(
    userId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ paidLeaves: number; unpaidLeaves: number }> {
    // All approved leaves for this employee (we'll filter by year/day below)
    const leaves = await this.leaveRepo.find({
      where: {
        employeeId: userId,
        tenantId,
        status: LeaveStatus.APPROVED,
      },
      relations: ['leaveType'],
    });

    // We enforce annual entitlement per calendar year
    const targetYear = startDate.getFullYear();

    type DayEntry = {
      date: Date;
      leaveTypeId: string;
      leaveTypeName: string;
      isPaidType: boolean;
      maxDaysPerYear: number | null;
    };

    const dayEntries: DayEntry[] = [];

    for (const leave of leaves) {
      if (!leave.startDate) continue;
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate || leave.startDate);
      leaveStart.setHours(0, 0, 0, 0);
      leaveEnd.setHours(0, 0, 0, 0);

      for (
        let d = new Date(leaveStart.getTime());
        d <= leaveEnd;
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
      ) {
        if (d.getFullYear() !== targetYear) continue;

        dayEntries.push({
          date: new Date(d.getTime()),
          leaveTypeId: leave.leaveTypeId,
          leaveTypeName: leave.leaveType?.name || '',
          isPaidType:
            leave.leaveType?.isPaid === undefined ? true : !!leave.leaveType.isPaid,
          maxDaysPerYear:
            typeof leave.leaveType?.maxDaysPerYear === 'number'
              ? leave.leaveType.maxDaysPerYear
              : null,
        });
      }
    }

    if (!dayEntries.length) {
      return { paidLeaves: 0, unpaidLeaves: 0 };
    }

    // Sort all leave days chronologically within the year
    dayEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let paidLeaves = 0;
    let unpaidLeaves = 0;

    // Track how many "annual" leave days have been used so far in the year per leave type
    const annualUsedPerType: Record<string, number> = {};

    for (const entry of dayEntries) {
      const isAnnual =
        entry.leaveTypeName.toLowerCase().includes('annual') ||
        entry.leaveTypeName.toLowerCase().includes('annual leave');

      let isPaidForThisDay = false;

      if (!entry.isPaidType) {
        // Explicitly unpaid leave type → always unpaid
        isPaidForThisDay = false;
      } else if (isAnnual && entry.maxDaysPerYear && entry.maxDaysPerYear > 0) {
        // Annual leave: only up to maxDaysPerYear are paid, rest are unpaid
        const key = entry.leaveTypeId || 'annual';
        const usedSoFar = annualUsedPerType[key] || 0;
        const nextCount = usedSoFar + 1;
        annualUsedPerType[key] = nextCount;

        if (nextCount <= entry.maxDaysPerYear) {
          isPaidForThisDay = true;
        } else {
          isPaidForThisDay = false;
        }
      } else {
        // Other paid leave types remain fully paid regardless of count
        isPaidForThisDay = entry.isPaidType;
      }

      // Only count days that fall within the current payroll period
      if (entry.date >= startDate && entry.date <= endDate) {
        if (isPaidForThisDay) {
          paidLeaves += 1;
        } else {
          unpaidLeaves += 1;
        }
      }
    }

    return { paidLeaves, unpaidLeaves };
  }

  private async calculateOvertime(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const attendances = await this.attendanceRepo.find({
      where: {
        user_id: userId,
        timestamp: Between(startDate, endDate),
        type: In([AttendanceType.CHECK_IN, AttendanceType.CHECK_OUT]),
      },
      order: { timestamp: 'ASC' },
    });

    let totalOvertimeHours = 0;
    const standardWorkHours = 8; // 8 hours per day

    const checkIns = attendances.filter((a) => a.type === AttendanceType.CHECK_IN);
    const checkOuts = attendances.filter((a) => a.type === AttendanceType.CHECK_OUT);

    for (const checkIn of checkIns) {
      const matchingCheckOut = checkOuts.find(
        (co) => co.timestamp > checkIn.timestamp && co.timestamp.toDateString() === checkIn.timestamp.toDateString(),
      );

      if (matchingCheckOut) {
        const hoursWorked =
          (new Date(matchingCheckOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime()) / (1000 * 60 * 60);
        if (hoursWorked > standardWorkHours) {
          totalOvertimeHours += hoursWorked - standardWorkHours;
        }
      }
    }

    return Math.round(totalOvertimeHours * 100) / 100;
  }

  private async calculateGrossSalary(
    salary: EmployeeSalary,
    _payrollConfig: PayrollConfig,
    workingDays: number,
    daysPresent: number,
    paidLeaves: number,
    _unpaidLeaves: number,
  ): Promise<number> {
    const baseSalary = Number(salary.baseSalary);
    const dailySalary = baseSalary / workingDays;

    // Calculate pro-rated salary based on attendance
    const effectiveDays = daysPresent + paidLeaves;
    let grossSalary = dailySalary * effectiveDays;

    // Add allowances
    const totalAllowances = this.calculateTotalAllowances(salary);
    grossSalary += totalAllowances;

    return Math.round(grossSalary * 100) / 100;
  }

  private calculateTotalAllowances(salary: EmployeeSalary): number {
    if (!salary.allowances || !Array.isArray(salary.allowances)) {
      return 0;
    }

    return salary.allowances.reduce((sum: number, allowance: any) => {
      if (allowance.amount) {
        return sum + allowance.amount;
      }
      if (allowance.percentage) {
        return sum + (Number(salary.baseSalary) * allowance.percentage) / 100;
      }
      return sum;
    }, 0);
  }

  private async calculateDeductions(
    grossSalary: number,
    payrollConfig: PayrollConfig,
    salary: EmployeeSalary,
    unpaidLeaves: number,
    workingDays: number,
  ): Promise<any> {
    const deductions: any = {
      tax: 0,
      insurance: 0,
      leaveDeductions: 0,
      otherDeductions: [],
    };

    // Tax deduction
    if (payrollConfig.deductions?.taxPercentage) {
      deductions.tax = (grossSalary * payrollConfig.deductions.taxPercentage) / 100;
    }

    // Insurance deduction
    if (payrollConfig.deductions?.insurancePercentage) {
      deductions.insurance = (grossSalary * payrollConfig.deductions.insurancePercentage) / 100;
    }

    // Leave deductions
    if (payrollConfig.leaveDeductionPolicy?.unpaidLeaveDeduction && unpaidLeaves > 0) {
        const baseSalary = Number(salary.baseSalary);
        const dailySalary = baseSalary / workingDays;
      deductions.leaveDeductions = dailySalary * unpaidLeaves;
    }

    // Other deductions from salary structure
    if (salary.deductions && Array.isArray(salary.deductions)) {
      for (const deduction of salary.deductions) {
        let amount = 0;
        if (deduction.amount) {
          amount = deduction.amount;
        } else if (deduction.percentage) {
          amount = (grossSalary * deduction.percentage) / 100;
        }
        deductions.otherDeductions.push({
          type: deduction.type,
          amount: Math.round(amount * 100) / 100,
        });
      }
    }

    return deductions;
  }

  private async calculateBonuses(
    employeeId: string,
    tenantId: string,
    grossSalary: number,
    overtimeHours: number,
    payrollConfig: PayrollConfig,
    month: number,
    year: number,
  ): Promise<any> {
    const bonuses: any = {
      performanceBonus: 0,
      overtimeBonus: 0,
      otherBonuses: [],
    };

    // Performance bonus (based on KPI scores)
    const cycle = `M${month}-${year}`;
    try {
      const kpiRecords = await this.employeeKpiRepo.find({
        where: {
          employee_id: employeeId,
          tenant_id: tenantId,
          reviewCycle: cycle,
        },
        relations: ['kpi'],
      });

      if (kpiRecords.length > 0) {
        const totalScore = kpiRecords.reduce((sum, record) => {
          if (record.kpi && record.score) {
            const weighted = record.score * (record.kpi.weight / 100);
            return sum + weighted;
          }
          return sum;
        }, 0);

        const avgScore = totalScore / kpiRecords.length;
        // Performance bonus: 5% of gross salary if score >= 4.0
        if (avgScore >= 4.0) {
          bonuses.performanceBonus = (grossSalary * 5) / 100;
        }
      }
    } catch (error) {
      // If no KPI records found, no performance bonus
    }

    // Overtime bonus
    if (payrollConfig.overtimePolicy?.enabled && overtimeHours > 0) {
      const hourlyRate = grossSalary / 160; // Assuming 160 working hours per month
      const overtimeMultiplier = payrollConfig.overtimePolicy.rateMultiplier || 1.5;
      bonuses.overtimeBonus = hourlyRate * overtimeHours * overtimeMultiplier;
    }

    return bonuses;
  }

  async getPayrollRecords(
    tenantId: string,
    month: number,
    year: number,
    employeeId?: string,
    page: number = 1,
    limit: number = 25,
  ): Promise<PaginationResponse<PayrollRecord>> {
    const skip = (page - 1) * limit;
    const where: any = {
      tenant_id: tenantId,
      month,
      year,
    };

    if (employeeId) {
      where.employee_id = employeeId;
    }

    const [items, total] = await this.payrollRecordRepo.findAndCount({
      where,
      relations: ['employee', 'employee.user', 'generatedBy'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
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

  async getEmployeePayrollHistory(
    employeeId: string,
    tenantId: string,
    page: number = 1,
    limit: number = 25,
  ): Promise<PaginationResponse<PayrollRecord>> {
    const skip = (page - 1) * limit;
    const [items, total] = await this.payrollRecordRepo.findAndCount({
      where: {
        employee_id: employeeId,
        tenant_id: tenantId,
      },
      relations: ['employee', 'employee.user', 'generatedBy'],
      order: { year: 'DESC', month: 'DESC' },
      skip,
      take: limit,
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

  async updatePayrollStatus(
    id: string,
    tenantId: string,
    userId: string,
    dto: UpdatePayrollStatusDto,
  ): Promise<PayrollRecord> {
    const payrollRecord = await this.payrollRecordRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!payrollRecord) {
      throw new NotFoundException('Payroll record not found');
    }

    payrollRecord.status = dto.status as PayrollStatus;

    if (dto.status === PayrollStatus.APPROVED) {
      payrollRecord.approved_by = userId;
      payrollRecord.approved_at = new Date();
    }

    if (dto.status === PayrollStatus.PAID) {
      payrollRecord.paid_at = new Date();
    }

    if (dto.remarks) {
      payrollRecord.remarks = dto.remarks;
    }

    return await this.payrollRecordRepo.save(payrollRecord);
  }

  async getPayslip(id: string, tenantId: string, userId: string, userRole: string): Promise<PayrollRecord> {
    const payrollRecord = await this.payrollRecordRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['employee', 'employee.user', 'generatedBy', 'approvedBy'],
    });

    if (!payrollRecord) {
      throw new NotFoundException('Payroll record not found');
    }

    // Check access: employees can only view their own payslip
    if (userRole === 'employee' && payrollRecord.employee.user_id !== userId) {
      throw new NotFoundException('Payroll record not found');
    }

    return payrollRecord;
  }

  async getPayrollSummary(tenantId: string, month: number, year: number): Promise<any> {
    const payrollRecords = await this.payrollRecordRepo.find({
      where: {
        tenant_id: tenantId,
        month,
        year,
      },
      relations: ['employee', 'employee.user', 'employee.designation', 'employee.designation.department'],
    });

    const totalGrossPayouts = payrollRecords.reduce((sum, record) => sum + Number(record.grossSalary), 0);
    const totalDeductions = payrollRecords.reduce((sum, record) => sum + Number(record.totalDeductions), 0);
    const totalBonuses = payrollRecords.reduce((sum, record) => sum + Number(record.bonuses), 0);
    const totalNetPayouts = payrollRecords.reduce((sum, record) => sum + Number(record.netSalary), 0);

    // Department-level costs
    const departmentCosts: Record<string, any> = {};
    for (const record of payrollRecords) {
      const deptName = record.employee?.designation?.department?.name || 'Unassigned';
      if (!departmentCosts[deptName]) {
        departmentCosts[deptName] = {
          grossSalary: 0,
          deductions: 0,
          bonuses: 0,
          netSalary: 0,
          employeeCount: 0,
        };
      }
      departmentCosts[deptName].grossSalary += Number(record.grossSalary);
      departmentCosts[deptName].deductions += Number(record.totalDeductions);
      departmentCosts[deptName].bonuses += Number(record.bonuses);
      departmentCosts[deptName].netSalary += Number(record.netSalary);
      departmentCosts[deptName].employeeCount += 1;
    }

    return {
      month,
      year,
      totalGrossPayouts,
      totalDeductions,
      totalBonuses,
      totalNetPayouts,
      employeeCount: payrollRecords.length,
      departmentCosts: Object.entries(departmentCosts).map(([name, data]) => ({
        department: name,
        ...data,
      })),
    };
  }

  async getPayrollStatistics(tenantId: string, startDate?: Date, endDate?: Date): Promise<any> {
    // If tenantId is provided, get statistics for that tenant only
    // Otherwise, get statistics for all tenants (system-admin access)
    let tenants: Tenant[] = [];
    
    if (tenantId) {
      const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
      if (tenant) {
        tenants = [tenant];
      }
    } else {
      // Get all tenants for system-admin
      tenants = await this.tenantRepo.find();
    }

    const allRecords: PayrollRecord[] = [];

    // Get records for each tenant
    for (const tenant of tenants) {
      const query = this.payrollRecordRepo
        .createQueryBuilder('record')
        .where('record.tenant_id = :tenantId', { tenantId: tenant.id })
        .andWhere('record.status = :status', { status: PayrollStatus.PAID });

      if (startDate) {
        query.andWhere('(record.year > :startYear OR (record.year = :startYear AND record.month >= :startMonth))', {
          startYear: startDate.getFullYear(),
          startMonth: startDate.getMonth() + 1,
        });
      }

      if (endDate) {
        query.andWhere('(record.year < :endYear OR (record.year = :endYear AND record.month <= :endMonth))', {
          endYear: endDate.getFullYear(),
          endMonth: endDate.getMonth() + 1,
        });
      }

      const records = await query
        .leftJoinAndSelect('record.employee', 'employee')
        .leftJoinAndSelect('employee.designation', 'designation')
        .leftJoinAndSelect('designation.department', 'department')
        .getMany();

      allRecords.push(...records);
    }

    // Group by tenant and month
    const tenantMonthlyData: Record<string, Record<string, any>> = {};
    const tenantDepartmentStats: Record<string, Record<string, any>> = {};

    for (const record of allRecords) {
      const tenantIdKey = record.tenant_id;
      
      // Initialize tenant data if not exists
      if (!tenantMonthlyData[tenantIdKey]) {
        tenantMonthlyData[tenantIdKey] = {};
      }
      if (!tenantDepartmentStats[tenantIdKey]) {
        tenantDepartmentStats[tenantIdKey] = {};
      }

      // Group by month
      const key = `${record.year}-${record.month.toString().padStart(2, '0')}`;
      if (!tenantMonthlyData[tenantIdKey][key]) {
        tenantMonthlyData[tenantIdKey][key] = {
          tenantId: tenantIdKey,
          month: record.month,
          year: record.year,
          totalGross: 0,
          totalDeductions: 0,
          totalBonuses: 0,
          totalNet: 0,
          employeeCount: 0,
        };
      }
      tenantMonthlyData[tenantIdKey][key].totalGross += Number(record.grossSalary);
      tenantMonthlyData[tenantIdKey][key].totalDeductions += Number(record.totalDeductions);
      tenantMonthlyData[tenantIdKey][key].totalBonuses += Number(record.bonuses);
      tenantMonthlyData[tenantIdKey][key].totalNet += Number(record.netSalary);
      tenantMonthlyData[tenantIdKey][key].employeeCount += 1;

      // Group by department
      const deptName = record.employee?.designation?.department?.name || 'Unassigned';
      if (!tenantDepartmentStats[tenantIdKey][deptName]) {
        tenantDepartmentStats[tenantIdKey][deptName] = {
          tenantId: tenantIdKey,
          department: deptName,
          totalGross: 0,
          totalDeductions: 0,
          totalBonuses: 0,
          totalNet: 0,
          employeeCount: 0,
        };
      }
      tenantDepartmentStats[tenantIdKey][deptName].totalGross += Number(record.grossSalary);
      tenantDepartmentStats[tenantIdKey][deptName].totalDeductions += Number(record.totalDeductions);
      tenantDepartmentStats[tenantIdKey][deptName].totalBonuses += Number(record.bonuses);
      tenantDepartmentStats[tenantIdKey][deptName].totalNet += Number(record.netSalary);
      tenantDepartmentStats[tenantIdKey][deptName].employeeCount += 1;
    }

    // Convert to array format with tenantId
    const tenantStatistics = Object.keys(tenantMonthlyData).map((tId) => {
      const monthlyData = tenantMonthlyData[tId];
      const deptStats = tenantDepartmentStats[tId];
      if (!monthlyData || !deptStats) return null;
      
      const monthlyTrend = Object.values(monthlyData).sort((a: any, b: any) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      const departmentComparison = Object.values(deptStats);

      return {
        tenantId: tId,
        monthlyTrend,
        departmentComparison,
      };
    }).filter((stat): stat is NonNullable<typeof stat> => stat !== null);

    return {
      statistics: tenantStatistics,
    };
  }
}

