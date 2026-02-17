import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leave } from '../../entities/leave.entity';
import { LeaveType } from '../../entities/leave-type.entity';
import { User } from '../../entities/user.entity';
import { Employee } from '../../entities/employee.entity';
import { LeaveStatus } from '../../common/constants/enums';

@Injectable()
export class LeaveReportsService {
  constructor(
    @InjectRepository(Leave)
    private leaveRepo: Repository<Leave>,
    @InjectRepository(LeaveType)
    private leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
  ) { }

  async getLeaveSummary(employeeId: string, year: number, tenantId: string) {
    // Verify employee exists and belongs to tenant
    const employee = await this.userRepo.findOne({
      where: { id: employeeId, tenant_id: tenantId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    // Get all leave types for the tenant
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { tenantId, status: 'active' },
    });

    // Get leave summary for each type
    const summary = await Promise.all(
      leaveTypes.map(async (leaveType) => {
        // Use QueryBuilder for more reliable date range queries
        // Check for overlap: leave overlaps with year if startDate <= endOfYear AND endDate >= startOfYear
        const leaves = await this.leaveRepo
          .createQueryBuilder('leave')
          .where('leave.employeeId = :employeeId', { employeeId })
          .andWhere('leave.leaveTypeId = :leaveTypeId', { leaveTypeId: leaveType.id })
          .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
          .andWhere('leave.startDate <= :endOfYear', { endOfYear })
          .andWhere('leave.endDate >= :startOfYear', { startOfYear })
          .getMany();

        const used = leaves.reduce((total, leave) => total + this.calculateWorkingDaysInRange(leave.startDate, leave.endDate, startOfYear, endOfYear), 0);
        // Allow remaining to go negative if usage exceeds entitlement
        const remaining = leaveType.maxDaysPerYear - used;

        return {
          type: leaveType.name,
          used,
          remaining,
        };
      })
    );

    return {
      employeeId,
      year,
      summary,
    };
  }

  async getTeamLeaveSummary(managerId: string, month: number, year: number, tenantId: string) {
    // Verify manager exists and belongs to tenant
    const manager = await this.userRepo.findOne({
      where: { id: managerId, tenant_id: tenantId },
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    // Get team members
    const teamMembers = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .leftJoin('employee.team', 'team')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('team.manager_id = :managerId', { managerId })
      .andWhere('employee.user_id != :managerId', { managerId })
      .getMany();

    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Get leave data for team members
    // Check for overlap: leave overlaps with month if startDate <= endOfMonth AND endDate >= startOfMonth
    const teamLeaveData = await Promise.all(
      teamMembers.map(async (member) => {
        const leaves = await this.leaveRepo
          .createQueryBuilder('leave')
          .where('leave.employeeId = :employeeId', { employeeId: member.user_id })
          .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
          .andWhere('leave.startDate <= :endOfMonth', { endOfMonth })
          .andWhere('leave.endDate >= :startOfMonth', { startOfMonth })
          .leftJoinAndSelect('leave.leaveType', 'leaveType')
          .getMany();

        const leaveSummary = leaves.map((leave) => ({
          type: leave.leaveType.name,
          days: this.calculateWorkingDaysInRange(leave.startDate, leave.endDate, startOfMonth, endOfMonth),
          startDate: leave.startDate,
          endDate: leave.endDate,
        }));

        return {
          employeeId: member.user_id,
          name: `${member.user.first_name} ${member.user.last_name}`,
          email: member.user.email,
          department: member.designation?.department?.name || 'N/A',
          designation: member.designation?.title || 'N/A',
          leaves: leaveSummary,
          totalLeaveDays: leaveSummary.reduce((total, l) => total + l.days, 0),
        };
      })
    );

    return {
      managerId,
      month,
      year,
      teamMembers: teamLeaveData,
      totalTeamMembers: teamMembers.length,
      membersOnLeave: teamLeaveData.filter((member) => member.totalLeaveDays > 0).length,
    };
  }

  async getLeaveBalance(
    employeeId: string,
    tenantId: string,
    year?: number,
    month?: number,
  ) {
    // Verify employee exists and belongs to tenant
    const employee = await this.userRepo.findOne({
      where: { id: employeeId, tenant_id: tenantId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const now = new Date();
    const targetYear = year ?? now.getFullYear();

    // Year range (always used for balance / remaining)
    const startOfYear = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    // Optional month range just for "usedThisMonth"
    let monthStart: Date | undefined;
    let monthEnd: Date | undefined;
    const validMonth = month && month >= 1 && month <= 12;
    if (validMonth) {
      monthStart = new Date(targetYear, month! - 1, 1, 0, 0, 0, 0);
      monthEnd = new Date(targetYear, month!, 0, 23, 59, 59, 999);
    }

    // Get all leave types for the tenant
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { tenantId, status: 'active' },
    });

    // Calculate balance using shared logic
    const balances = await this.calculateEmployeeLeaveBalance(employeeId, targetYear, leaveTypes, validMonth ? month : undefined);

    return {
      employeeId,
      year: targetYear,
      ...(validMonth ? { month } : {}),
      balances,
    };
  }

  async getAllLeaveReports(
    tenantId: string,
    page: number = 1,
    year?: number,
    employeeName?: string,
  ) {
    const targetYear = year ?? new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    const limit = 25;
    const skip = (page - 1) * limit;

    // Build the employee query
    const employeeQuery = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('user.tenant_id = :tenantId', { tenantId });

    if (employeeName) {
      // Match by full name (first + last) so "Alex Parker" returns only that employee, not "Alex Pen"
      const trimmedName = employeeName.trim().replace(/\s+/g, ' ');
      employeeQuery.andWhere(
        `LOWER(TRIM(CONCAT(COALESCE(user.first_name, ''), ' ', COALESCE(user.last_name, '')))) = LOWER(:name)`,
        { name: trimmedName },
      );
    }

    const [allEmployees, total] = await employeeQuery
      .orderBy('user.first_name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Fetch leaves for the *entire year* for these employees to do the calculation in memory
    // (Optimization: Fetching all leaves for the page of employees)
    const employeeIds = allEmployees.map((e) => e.user_id);
    let leavesByEmployee: Record<string, Leave[]> = {};

    if (employeeIds.length > 0) {
      const leaves = await this.leaveRepo
        .createQueryBuilder('leave')
        .leftJoinAndSelect('leave.leaveType', 'leaveType')
        .where('leave.employeeId IN (:...employeeIds)', { employeeIds })
        // We fetch ALL leaves for the target year to ensure correct annual calculation
        // regardless of any "month" concept (which we are removing from the filter)
        .andWhere('leave.startDate <= :endDate', { endDate })
        .andWhere('leave.endDate >= :startDate', { startDate })
        .getMany();

      // Group leaves by employee
      leaves.forEach((leave) => {
        if (!leavesByEmployee[leave.employeeId]) {
          leavesByEmployee[leave.employeeId] = [];
        }
        leavesByEmployee[leave.employeeId].push(leave);
      });
    }

    // Get all leave types for the tenant
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { tenantId, status: 'active' },
    });

    // Generate comprehensive report for each employee
    const employeeReportsPromises = allEmployees.map(async (employee) => {
      // Calculate balance using shared logic - Single Source of Truth
      // force Annual calculation by NOT passing month
      const balances = await this.calculateEmployeeLeaveBalance(employee.user_id, targetYear, leaveTypes);

      return { employee, balances };
    });

    // Resolve all balance calculations
    const employeeReportsWithBalances = await Promise.all(employeeReportsPromises);

    const employeeReports = employeeReportsWithBalances.map(({ employee, balances }) => {
      const employeeYearLeaves = leavesByEmployee[employee.user_id] || [];

      // Since we removed month filtering, "periodLeaves" is just "employeeYearLeaves"
      // But we'll keep the variable name if we want to support range filtering later, 
      // otherwise we can just use employeeYearLeaves.
      const periodLeaves = employeeYearLeaves;

      // Calculate leave summary by type using the accurate balances
      const leaveSummary = balances.map((balance) => {
        const typeLeaves = employeeYearLeaves.filter((l) => l.leaveTypeId === balance.leaveTypeId);

        // Annual usage/status for non-approved states
        const pendingDays = typeLeaves
          .filter((l) => l.status === LeaveStatus.PENDING)
          .reduce((sum, l) => sum + this.calculateWorkingDaysInRange(l.startDate, l.endDate, startDate, endDate), 0);

        const rejectedDays = typeLeaves
          .filter((l) => l.status === LeaveStatus.REJECTED)
          .reduce((sum, l) => sum + this.calculateWorkingDaysInRange(l.startDate, l.endDate, startDate, endDate), 0);

        // APPROVED DAYS: Always use Annual Usage (balance.used)
        const approvedDays = balance.used;

        return {
          leaveTypeId: balance.leaveTypeId,
          leaveTypeName: balance.leaveTypeName,
          totalDays: approvedDays + pendingDays + rejectedDays,
          approvedDays,
          pendingDays,
          rejectedDays,
          maxDaysPerYear: balance.maxDaysPerYear,
          remainingDays: balance.remaining,
        };
      });

      const leaveRecords = periodLeaves.map((leave) => ({
        id: leave.id,
        leaveTypeName: leave.leaveType?.name || 'Unknown',
        startDate: leave.startDate,
        endDate: leave.endDate,
        totalDays: this.calculateWorkingDaysInRange(leave.startDate, leave.endDate, startDate, endDate),
        status: leave.status,
        reason: leave.reason,
        appliedDate: leave.createdAt,
        approvedBy: leave.approvedBy,
        approvedDate: leave.approvedAt,
      }));

      return {
        employeeId: employee.user_id,
        employeeName: `${employee.user.first_name} ${employee.user.last_name}`,
        email: employee.user.email,
        department: employee.designation?.department?.name || 'N/A',
        designation: employee.designation?.title || 'N/A',
        leaveSummary,
        leaveRecords,
        totals: {
          totalLeaveDays: leaveSummary.reduce((sum, s) => sum + s.totalDays, 0),
          approvedLeaveDays: leaveSummary.reduce((sum, s) => sum + s.approvedDays, 0),
          pendingLeaveDays: leaveSummary.reduce((sum, s) => sum + s.pendingDays, 0),
          totalLeaveRequests: periodLeaves.length,
          approvedRequests: periodLeaves.filter(l => l.status === LeaveStatus.APPROVED).length,
          pendingRequests: periodLeaves.filter(l => l.status === LeaveStatus.PENDING).length,
          rejectedRequests: periodLeaves.filter(l => l.status === LeaveStatus.REJECTED).length,
        },
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      employeeReports: {
        items: employeeReports,
        total: total,
        page,
        limit,
        totalPages,
      },
    };
  }

  // Shared calculation method - Single Source of Truth
  private async calculateEmployeeLeaveBalance(
    employeeId: string,
    targetYear: number,
    leaveTypes: LeaveType[],
    month?: number,
  ) {
    // Year range (always used for balance / remaining)
    const startOfYear = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

    // Optional month range just for "usedThisMonth" or period-specific reporting
    let monthStart: Date | undefined;
    let monthEnd: Date | undefined;
    const validMonth = month && month >= 1 && month <= 12;

    if (validMonth) {
      monthStart = new Date(Date.UTC(targetYear, month! - 1, 1, 0, 0, 0, 0));
      monthEnd = new Date(Date.UTC(targetYear, month!, 0, 23, 59, 59, 999));
    }

    // Get all approved leaves for the year in one go to minimize queries 
    // (This query could be optimized further by caller if doing bulk processing, 
    // but here we focus on logic consistency)
    const yearLeaves = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.employeeId = :employeeId', { employeeId })
      .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('leave.startDate <= :endOfYear', { endOfYear })
      .andWhere('leave.endDate >= :startOfYear', { startOfYear })
      .getMany();

    // Calculate balance for each leave type
    const balances = leaveTypes.map((leaveType) => {
      // Filter leaves for this specific type
      const typeLeaves = yearLeaves.filter(l => l.leaveTypeId === leaveType.id);

      // Annual usage calculation
      const usedYear = typeLeaves.reduce((total, leave) =>
        total + this.calculateWorkingDaysInRange(leave.startDate, leave.endDate, startOfYear, endOfYear), 0);

      // Monthly usage calculation (if applicable)
      let usedThisMonth = 0;
      if (validMonth && monthStart && monthEnd) {
        usedThisMonth = typeLeaves.reduce((total, leave) =>
          total + this.calculateWorkingDaysInRange(leave.startDate, leave.endDate, monthStart!, monthEnd!), 0);
      }

      // Remaining is always based on annual usage
      // Allows negative values to support overuse cases as per requirements
      const remaining = leaveType.maxDaysPerYear - usedYear;

      return {
        leaveTypeId: leaveType.id,
        leaveTypeName: leaveType.name,
        maxDaysPerYear: leaveType.maxDaysPerYear,
        used: usedYear,
        ...(validMonth ? { usedThisMonth } : {}),
        remaining,
        carryForward: leaveType.carryForward,
      };
    });

    return balances;
  }

  private calculateWorkingDaysInRange(
    leaveStart: Date | string,
    leaveEnd: Date | string,
    rangeStart: Date,
    rangeEnd: Date,
  ): number {
    const lStart = new Date(leaveStart);
    const lEnd = new Date(leaveEnd);

    // Normalize to same timezone logic for comparison (UTC based)
    const start = new Date(Math.max(lStart.getTime(), rangeStart.getTime()));
    const end = new Date(Math.min(lEnd.getTime(), rangeEnd.getTime()));

    if (start > end) return 0;

    let workingDays = 0;
    const current = new Date(start);
    // Ensure we work with UTC midnight for safe day retrieval
    current.setUTCHours(0, 0, 0, 0);

    const endTimestamp = end.getTime();

    while (current.getTime() <= endTimestamp) {
      const day = current.getUTCDay(); // 0 is Sunday, 6 is Saturday
      if (day !== 0 && day !== 6) { // Exclude weekends
        workingDays++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(0, 0, 0, 0);
    }
    return workingDays;
  }
}
