import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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
  ) {}

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
        const leaves = await this.leaveRepo
          .createQueryBuilder('leave')
          .where('leave.employeeId = :employeeId', { employeeId })
          .andWhere('leave.leaveTypeId = :leaveTypeId', { leaveTypeId: leaveType.id })
          .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
          .andWhere('leave.startDate >= :startOfYear', { startOfYear })
          .andWhere('leave.startDate <= :endOfYear', { endOfYear })
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
    const teamLeaveData = await Promise.all(
      teamMembers.map(async (member) => {
        const leaves = await this.leaveRepo.find({
          where: {
            employeeId: member.user_id,
            startDate: Between(startOfMonth, endOfMonth),
            status: LeaveStatus.APPROVED,
          },
          relations: ['leaveType'],
        });

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
        // All approved leaves for this type in the whole year
        const yearLeaves = await this.leaveRepo
          .createQueryBuilder('leave')
          .where('leave.employeeId = :employeeId', { employeeId })
          .andWhere('leave.leaveTypeId = :leaveTypeId', { leaveTypeId: leaveType.id })
          .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
          .andWhere('leave.startDate >= :startOfYear', { startOfYear })
          .andWhere('leave.startDate <= :endOfYear', { endOfYear })
          .getMany();

        const usedYear = yearLeaves.reduce((total, leave) => total + leave.totalDays, 0);

        let usedThisMonth = 0;
        if (validMonth && monthStart && monthEnd) {
          usedThisMonth = yearLeaves
            .filter(
              (l) =>
                l.startDate >= monthStart! &&
                l.startDate <= monthEnd!,
            )
            .reduce((total, leave) => total + leave.totalDays, 0);
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

  async getAllLeaveReports(tenantId: string, page: number = 1, month?: number) {
    const currentYear = new Date().getFullYear();

    let startDate: Date;
    let endDate: Date;

    if (month && month >= 1 && month <= 12) {
      // Specific month range within current year
      startDate = new Date(currentYear, month - 1, 1);
      endDate = new Date(currentYear, month, 0, 23, 59, 59, 999);
    } else {
      // Full year range
      startDate = new Date(currentYear, 0, 1);
      endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
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

    // Get all leaves for the current year (for all employees to calculate org stats)
    const allEmployeeIds = allEmployees.map(emp => emp.user_id);
    const allLeaves = await this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.leaveType', 'leaveType')
      .leftJoinAndSelect('leave.employee', 'employee')
      .where('leave.startDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('leave.employeeId IN (:...allEmployeeIds)', { allEmployeeIds })
      .getMany();

    // Get leaves for paginated employees only
    const employeeIds = employees.map(emp => emp.user_id);
    const leaves = allLeaves.filter(leave => employeeIds.includes(leave.employeeId));

    // Group leaves by employee
    const leavesByEmployee = leaves.reduce((acc, leave) => {
      if (!leave.employeeId) return acc;
      if (!acc[leave.employeeId]) {
        acc[leave.employeeId] = [];
      }
      const employeeLeaves = acc[leave.employeeId];
      if (employeeLeaves) {
        employeeLeaves.push(leave);
      }
      return acc;
    }, {} as Record<string, Leave[]>);

    // Generate comprehensive report for each employee
    const employeeReports = await Promise.all(
      employees.map(async (employee) => {
        const employeeLeaves = leavesByEmployee[employee.user_id] || [];
        
        // Calculate leave summary by type
        const leaveSummary = leaveTypes.map(leaveType => {
          const typeLeaves = employeeLeaves.filter(leave => leave.leaveTypeId === leaveType.id);
          const totalDays = typeLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);
          const approvedDays = typeLeaves
            .filter(leave => leave.status === LeaveStatus.APPROVED)
            .reduce((sum, leave) => sum + leave.totalDays, 0);
          const pendingDays = typeLeaves
            .filter(leave => leave.status === LeaveStatus.PENDING)
            .reduce((sum, leave) => sum + leave.totalDays, 0);
          const rejectedDays = typeLeaves
            .filter(leave => leave.status === LeaveStatus.REJECTED)
            .reduce((sum, leave) => sum + leave.totalDays, 0);

          return {
            leaveTypeId: leaveType.id,
            leaveTypeName: leaveType.name,
            totalDays,
            approvedDays,
            pendingDays,
            rejectedDays,
            maxDaysPerYear: leaveType.maxDaysPerYear,
            // Allow negative remaining if approvedDays exceed entitlement
            remainingDays: leaveType.maxDaysPerYear - approvedDays,
          };
        });

        // Get detailed leave records
        const leaveRecords = employeeLeaves.map(leave => ({
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
        const totalLeaveDays = employeeLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);
        const approvedLeaveDays = employeeLeaves
          .filter(leave => leave.status === LeaveStatus.APPROVED)
          .reduce((sum, leave) => sum + leave.totalDays, 0);
        const pendingLeaveDays = employeeLeaves
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
            totalLeaveRequests: employeeLeaves.length,
            approvedRequests: employeeLeaves.filter(leave => leave.status === LeaveStatus.APPROVED).length,
            pendingRequests: employeeLeaves.filter(leave => leave.status === LeaveStatus.PENDING).length,
            rejectedRequests: employeeLeaves.filter(leave => leave.status === LeaveStatus.REJECTED).length,
          },
        };
      })
    );

    // Calculate organization-wide statistics (using all employees, not just current page)
    const allLeavesByEmployee = allLeaves.reduce((acc, leave) => {
      if (!leave.employeeId) return acc;
      if (!acc[leave.employeeId]) {
        acc[leave.employeeId] = [];
      }
      const employeeLeaves = acc[leave.employeeId];
      if (employeeLeaves) {
        employeeLeaves.push(leave);
      }
      return acc;
    }, {} as Record<string, Leave[]>);

    const allEmployeeReports = await Promise.all(
      allEmployees.map(async (employee) => {
        const employeeLeaves = allLeavesByEmployee[employee.user_id] || [];
        const totalLeaveDays = employeeLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);
        const approvedLeaveDays = employeeLeaves
          .filter(leave => leave.status === LeaveStatus.APPROVED)
          .reduce((sum, leave) => sum + leave.totalDays, 0);
        const pendingLeaveDays = employeeLeaves
          .filter(leave => leave.status === LeaveStatus.PENDING)
          .reduce((sum, leave) => sum + leave.totalDays, 0);

        return {
          totalLeaveDays,
          approvedLeaveDays,
          pendingLeaveDays,
          totalLeaveRequests: employeeLeaves.length,
          approvedRequests: employeeLeaves.filter(leave => leave.status === LeaveStatus.APPROVED).length,
          pendingRequests: employeeLeaves.filter(leave => leave.status === LeaveStatus.PENDING).length,
          rejectedRequests: employeeLeaves.filter(leave => leave.status === LeaveStatus.REJECTED).length,
        };
      })
    );

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
        year: currentYear,
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
