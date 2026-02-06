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

    // Calculate balance for each leave type
    const balances = await Promise.all(
      leaveTypes.map(async (leaveType) => {
        // All approved leaves for this type that overlap with the year
        // Check for overlap: leave overlaps with year if startDate <= endOfYear AND endDate >= startOfYear
        const yearLeaves = await this.leaveRepo
          .createQueryBuilder('leave')
          .where('leave.employeeId = :employeeId', { employeeId })
          .andWhere('leave.leaveTypeId = :leaveTypeId', { leaveTypeId: leaveType.id })
          .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
          .andWhere('leave.startDate <= :endOfYear', { endOfYear })
          .andWhere('leave.endDate >= :startOfYear', { startOfYear })
          .getMany();

        const usedYear = yearLeaves.reduce((total, leave) => total + this.calculateWorkingDaysInRange(leave.startDate, leave.endDate, startOfYear, endOfYear), 0);

        let usedThisMonth = 0;
        if (validMonth && monthStart && monthEnd) {
          usedThisMonth = yearLeaves.reduce((total, leave) => total + this.calculateWorkingDaysInRange(leave.startDate, leave.endDate, monthStart!, monthEnd!), 0);
        }

        // Remaining is always based on annual usage
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
      })
    );

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
    month?: number,
    year?: number,
    employeeName?: string,
  ) {
    const targetYear = year ?? new Date().getFullYear();

    let startDate: Date;
    let endDate: Date;

    if (month && month >= 1 && month <= 12) {
      // Specific month range within target year
      startDate = new Date(targetYear, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, month, 0, 23, 59, 59, 999);
    } else {
      // Full year range
      startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    }
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
      employeeQuery.andWhere(
        '(user.first_name ILIKE :name OR user.last_name ILIKE :name)',
        { name: `%${employeeName}%` },
      );
    }

    // Get all employees for the tenant (matching filter) (for organization stats)
    const allEmployees = await employeeQuery.getMany();
    // Ensure unique employees (should be unique by ID already, but good safety)
    const uniqueEmployees = Array.from(new Map(allEmployees.map(e => [e.user_id, e])).values());

    // Get paginated employees for the current page
    const paginatedEmployees = uniqueEmployees.slice(skip, skip + limit);

    // Get all leave types for the tenant
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { tenantId, status: 'active' },
    });

    // We need two date ranges for calculations:
    // 1. The period range (month or year) for "period usage"
    // 2. The full year range for "annual balance"
    const startOfYear = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    // Get all leaves for the target year for all filtered employees
    const allEmployeeIds = uniqueEmployees.map((emp) => emp.user_id);
    if (allEmployeeIds.length === 0) {
      return {
        employeeReports: {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    const allYearLeaves = await this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.leaveType', 'leaveType')
      .where('leave.tenantId = :tenantId', { tenantId })
      .andWhere('leave.employeeId IN (:...allEmployeeIds)', { allEmployeeIds })
      .andWhere('leave.startDate <= :endOfYear', { endOfYear })
      .andWhere('leave.endDate >= :startOfYear', { startOfYear })
      .getMany();

    // Group leaves by employee for easy access
    const leavesByEmployee = allYearLeaves.reduce((acc, leave) => {
      if (!acc[leave.employeeId]) acc[leave.employeeId] = [];
      acc[leave.employeeId].push(leave);
      return acc;
    }, {} as Record<string, Leave[]>);

    // Generate comprehensive report for each employee
    const employeeReports = paginatedEmployees.map((employee) => {
      const employeeYearLeaves = leavesByEmployee[employee.user_id] || [];

      // Calculate leave summary by type
      const leaveSummary = leaveTypes.map((leaveType) => {
        // Annual approved days (consistent with getLeaveBalance)
        const annualApprovedDays = employeeYearLeaves
          .filter((l) => l.leaveTypeId === leaveType.id && l.status === LeaveStatus.APPROVED)
          .reduce((sum, l) => sum + this.calculateWorkingDaysInRange(l.startDate, l.endDate, startOfYear, endOfYear), 0);

        // Period specific usage/status
        const typeYearLeaves = employeeYearLeaves.filter((l) => l.leaveTypeId === leaveType.id);

        const approvedDays = typeYearLeaves
          .filter((l) => l.status === LeaveStatus.APPROVED)
          .reduce((sum, l) => sum + this.calculateWorkingDaysInRange(l.startDate, l.endDate, startDate, endDate), 0);

        const pendingDays = typeYearLeaves
          .filter((l) => l.status === LeaveStatus.PENDING)
          .reduce((sum, l) => sum + this.calculateWorkingDaysInRange(l.startDate, l.endDate, startDate, endDate), 0);

        const rejectedDays = typeYearLeaves
          .filter((l) => l.status === LeaveStatus.REJECTED)
          .reduce((sum, l) => sum + this.calculateWorkingDaysInRange(l.startDate, l.endDate, startDate, endDate), 0);

        return {
          leaveTypeId: leaveType.id,
          leaveTypeName: leaveType.name,
          totalDays: approvedDays + pendingDays + rejectedDays,
          approvedDays,
          pendingDays,
          rejectedDays,
          maxDaysPerYear: leaveType.maxDaysPerYear,
          remainingDays: Math.max(0, leaveType.maxDaysPerYear - annualApprovedDays),
        };
      });

      // Filter leaves that overlap with the period for detailed records
      const periodLeaves = employeeYearLeaves.filter((l) => {
        const lStart = new Date(l.startDate).getTime();
        const lEnd = new Date(l.endDate).getTime();
        const pStart = startDate.getTime();
        const pEnd = endDate.getTime();
        return lStart <= pEnd && lEnd >= pStart;
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

    const totalPages = Math.ceil(uniqueEmployees.length / limit);

    return {
      employeeReports: {
        items: employeeReports,
        total: uniqueEmployees.length,
        page,
        limit,
        totalPages,
      },
    };
  }

  private calculateWorkingDaysInRange(
    leaveStart: Date | string,
    leaveEnd: Date | string,
    rangeStart: Date,
    rangeEnd: Date,
  ): number {
    const lStart = new Date(leaveStart);
    const lEnd = new Date(leaveEnd);

    // Normalize to same timezone logic for comparison
    const start = new Date(Math.max(lStart.getTime(), rangeStart.getTime()));
    const end = new Date(Math.min(lEnd.getTime(), rangeEnd.getTime()));

    if (start > end) return 0;

    let workingDays = 0;
    const current = new Date(start);
    // Set to start of day (midnight) in local time for safe getDay() usage
    current.setHours(0, 0, 0, 0);

    const endTimestamp = end.getTime();

    while (current.getTime() <= endTimestamp) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // Exclude weekends
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }
    return workingDays;
  }
}
