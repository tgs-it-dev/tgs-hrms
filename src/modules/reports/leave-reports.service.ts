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

        const used = leaves.reduce((total, leave) => total + leave.totalDays, 0);
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

  // Monthly usage is now handled via optional month/year filters in getLeaveBalance

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

    const startOfMonth = new Date(year, month - 1, 1);
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
          days: leave.totalDays,
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
          totalLeaveDays: leaves.reduce((total, leave) => total + leave.totalDays, 0),
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

        const usedYear = yearLeaves.reduce((total, leave) => total + leave.totalDays, 0);

        let usedThisMonth = 0;
        if (validMonth && monthStart && monthEnd) {
          // Calculate days used in the specific month (only count days that fall within the month)
          usedThisMonth = yearLeaves
            .filter(
              (l) =>
                // Leave overlaps with month if startDate <= monthEnd AND endDate >= monthStart
                l.startDate <= monthEnd! &&
                l.endDate >= monthStart!,
            )
            .reduce((total, leave) => {
              // Calculate actual days within the month range
              const leaveStart = new Date(Math.max(leave.startDate.getTime(), monthStart!.getTime()));
              const leaveEnd = new Date(Math.min(leave.endDate.getTime(), monthEnd!.getTime()));
              // Count working days in the overlapping period
              let daysInMonth = 0;
              const current = new Date(leaveStart);
              while (current <= leaveEnd) {
                const day = current.getDay();
                if (day !== 0 && day !== 6) { // Exclude weekends
                  daysInMonth++;
                }
                current.setDate(current.getDate() + 1);
              }
              return total + daysInMonth;
            }, 0);
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

  async getAllLeaveReports(tenantId: string, page: number = 1, month?: number, year?: number) {
    const targetYear = year ?? new Date().getFullYear();

    let startDate: Date;
    let endDate: Date;

    if (month && month >= 1 && month <= 12) {
      // Specific month range within target year
      startDate = new Date(targetYear, month - 1, 1);
      endDate = new Date(targetYear, month, 0, 23, 59, 59, 999);
    } else {
      // Full year range
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    }
    const limit = 25;
    const skip = (page - 1) * limit;

    // Get all employees for the tenant (for organization stats)
    const allEmployees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('user.tenant_id = :tenantId', { tenantId })
      .getMany();

    // Get paginated employees for the current page
    const employees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('user.tenant_id = :tenantId', { tenantId })
      .skip(skip)
      .take(limit)
      .getMany();

    // Get all leave types for the tenant
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { tenantId, status: 'active' },
    });

    // We need two date ranges:
    // 1. The period range (month or year) for "period usage"
    // 2. The full year range for "annual balance"
    const startOfYear = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    // Get all APPROVED leaves for the target year for all employees (for org stats and balances)
    const allEmployeeIds = allEmployees.map((emp) => emp.user_id);
    const allYearLeaves = await this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.leaveType', 'leaveType')
      .where('leave.tenantId = :tenantId', { tenantId })
      .andWhere('leave.employeeId IN (:...allEmployeeIds)', { allEmployeeIds })
      .andWhere('leave.startDate <= :endOfYear', { endOfYear })
      .andWhere('leave.endDate >= :startOfYear', { startOfYear })
      // We include all statuses here to calculate pending/rejected, but mostly interested in APPROVED for balance
      .getMany();

    // Group leaves by employee for easy access
    const leavesByEmployeeYear = allYearLeaves.reduce((acc, leave) => {
      if (!acc[leave.employeeId]) acc[leave.employeeId] = [];
      acc[leave.employeeId].push(leave);
      return acc;
    }, {} as Record<string, Leave[]>);

    // Filter for the specific period (month or year)
    const periodLeaves = allYearLeaves.filter(
      (leave) => leave.startDate <= endDate && leave.endDate >= startDate,
    );

    // Generate comprehensive report for each employee
    const employeeReports = await Promise.all(
      employees.map(async (employee) => {
        const employeeYearLeaves = leavesByEmployeeYear[employee.user_id] || [];
        const employeePeriodLeaves = periodLeaves.filter((l) => l.employeeId === employee.user_id);

        // Calculate leave summary by type
        const leaveSummary = leaveTypes.map((leaveType) => {
          // Annual approved days for balance calculation
          const annualApprovedDays = employeeYearLeaves
            .filter((l) => l.leaveTypeId === leaveType.id && l.status === LeaveStatus.APPROVED)
            .reduce((sum, l) => sum + l.totalDays, 0);

          // Period specific usage/status
          const typePeriodLeaves = employeePeriodLeaves.filter((l) => l.leaveTypeId === leaveType.id);
          const totalDays = typePeriodLeaves.reduce((sum, l) => sum + l.totalDays, 0);
          const approvedDays = typePeriodLeaves
            .filter((l) => l.status === LeaveStatus.APPROVED)
            .reduce((sum, l) => sum + l.totalDays, 0);
          const pendingDays = typePeriodLeaves
            .filter((l) => l.status === LeaveStatus.PENDING)
            .reduce((sum, l) => sum + l.totalDays, 0);
          const rejectedDays = typePeriodLeaves
            .filter((l) => l.status === LeaveStatus.REJECTED)
            .reduce((sum, l) => sum + l.totalDays, 0);

          return {
            leaveTypeId: leaveType.id,
            leaveTypeName: leaveType.name,
            totalDays, // Total requested in period
            approvedDays, // Approved in period
            pendingDays, // Pending in period
            rejectedDays, // Rejected in period
            maxDaysPerYear: leaveType.maxDaysPerYear,
            // REMAINING IS ALWAYS ANNUAL: Entitlement - Annual Approved
            remainingDays: leaveType.maxDaysPerYear - annualApprovedDays,
          };
        });

        // Get detailed leave records (for period)
        const leaveRecords = employeePeriodLeaves.map((leave) => ({
          id: leave.id,
          leaveTypeName: leave.leaveType?.name || 'Unknown',
          startDate: leave.startDate,
          endDate: leave.endDate,
          totalDays: leave.totalDays,
          status: leave.status,
          reason: leave.reason,
          appliedDate: leave.createdAt,
          approvedBy: leave.approvedBy,
          approvedDate: leave.approvedAt,
        }));

        // Calculate totals
        const totalLeaveDays = employeePeriodLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);
        const approvedLeaveDays = employeePeriodLeaves
          .filter(leave => leave.status === LeaveStatus.APPROVED)
          .reduce((sum, leave) => sum + leave.totalDays, 0);
        const pendingLeaveDays = employeePeriodLeaves
          .filter(leave => leave.status === LeaveStatus.PENDING)
          .reduce((sum, leave) => sum + leave.totalDays, 0);

        return {
          employeeId: employee.user_id,
          employeeName: `${employee.user.first_name} ${employee.user.last_name}`,
          email: employee.user.email,
          department: employee.designation?.department?.name || 'N/A',
          designation: employee.designation?.title || 'N/A',
          leaveSummary,
          leaveRecords,
          totals: {
            totalLeaveDays,
            approvedLeaveDays,
            pendingLeaveDays,
            totalLeaveRequests: employeePeriodLeaves.length,
            approvedRequests: employeePeriodLeaves.filter(leave => leave.status === LeaveStatus.APPROVED).length,
            pendingRequests: employeePeriodLeaves.filter(leave => leave.status === LeaveStatus.PENDING).length,
            rejectedRequests: employeePeriodLeaves.filter(leave => leave.status === LeaveStatus.REJECTED).length,
          },
        };
      })
    );

    // Calculate organization-wide statistics (using period specific leaves)
    const allEmployeeReports = allEmployees.map((employee) => {
      const employeePeriodLeaves = periodLeaves.filter((l) => l.employeeId === employee.user_id);
      const totalLeaveDays = employeePeriodLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);
      const approvedLeaveDays = employeePeriodLeaves
        .filter((leave) => leave.status === LeaveStatus.APPROVED)
        .reduce((sum, leave) => sum + leave.totalDays, 0);
      const pendingLeaveDays = employeePeriodLeaves
        .filter((leave) => leave.status === LeaveStatus.PENDING)
        .reduce((sum, leave) => sum + leave.totalDays, 0);

      return {
        totalLeaveDays,
        approvedLeaveDays,
        pendingLeaveDays,
        totalLeaveRequests: employeePeriodLeaves.length,
        approvedRequests: employeePeriodLeaves.filter(
          (leave) => leave.status === LeaveStatus.APPROVED,
        ).length,
        pendingRequests: employeePeriodLeaves.filter(
          (leave) => leave.status === LeaveStatus.PENDING,
        ).length,
        rejectedRequests: employeePeriodLeaves.filter(
          (leave) => leave.status === LeaveStatus.REJECTED,
        ).length,
      };
    });

    const orgStats = {
      totalEmployees: allEmployees.length,
      employeesOnLeave: allEmployeeReports.filter(emp => emp.approvedLeaveDays > 0).length,
      totalLeaveDays: allEmployeeReports.reduce((sum, emp) => sum + emp.approvedLeaveDays, 0),
      totalPendingDays: allEmployeeReports.reduce((sum, emp) => sum + emp.pendingLeaveDays, 0),
      totalLeaveRequests: allEmployeeReports.reduce((sum, emp) => sum + emp.totalLeaveRequests, 0),
      approvedRequests: allEmployeeReports.reduce((sum, emp) => sum + emp.approvedRequests, 0),
      pendingRequests: allEmployeeReports.reduce((sum, emp) => sum + emp.pendingRequests, 0),
      rejectedRequests: allEmployeeReports.reduce((sum, emp) => sum + emp.rejectedRequests, 0),
    };

    const totalPages = Math.ceil(allEmployees.length / limit);

    return {
      period: {
        year: targetYear,
        ...(month && month >= 1 && month <= 12
          ? {
            month,
            startDate,
            endDate,
          }
          : {
            startDate,
            endDate,
          }),
      },
      organizationStats: orgStats,
      employeeReports: {
        items: employeeReports,
        total: allEmployees.length,
        page,
        limit,
        totalPages,
      },
      leaveTypes: leaveTypes.map(lt => ({
        id: lt.id,
        name: lt.name,
        maxDaysPerYear: lt.maxDaysPerYear,
        carryForward: lt.carryForward,
      })),
    };
  }
}
