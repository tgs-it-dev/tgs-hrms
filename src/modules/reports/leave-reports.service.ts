import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    // Get all leave types for the tenant
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { tenantId, status: 'active' },
    });

    // Get leave summary for each type
    const summary = await Promise.all(
      leaveTypes.map(async (leaveType) => {
        const leaves = await this.leaveRepo.find({
          where: {
            employeeId,
            leaveTypeId: leaveType.id,
            status: LeaveStatus.APPROVED,
            startDate: Between(startOfYear, endOfYear),
          },
        });

        const used = leaves.reduce((total, leave) => total + leave.totalDays, 0);
        const remaining = Math.max(0, leaveType.maxDaysPerYear - used);

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

  async getLeaveBalance(employeeId: string, tenantId: string) {
    // Verify employee exists and belongs to tenant
    const employee = await this.userRepo.findOne({
      where: { id: employeeId, tenant_id: tenantId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    // Get all leave types for the tenant
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { tenantId, status: 'active' },
    });

    // Calculate balance for each leave type
    const balances = await Promise.all(
      leaveTypes.map(async (leaveType) => {
        const leaves = await this.leaveRepo.find({
          where: {
            employeeId,
            leaveTypeId: leaveType.id,
            status: LeaveStatus.APPROVED,
            startDate: Between(startOfYear, endOfYear),
          },
        });

        const used = leaves.reduce((total, leave) => total + leave.totalDays, 0);
        const remaining = Math.max(0, leaveType.maxDaysPerYear - used);

        return {
          leaveTypeId: leaveType.id,
          leaveTypeName: leaveType.name,
          maxDaysPerYear: leaveType.maxDaysPerYear,
          used,
          remaining,
          carryForward: leaveType.carryForward,
        };
      })
    );

    return {
      employeeId,
      year: currentYear,
      balances,
    };
  }

  async getAllLeaveReports(tenantId: string) {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    // Get all employees for the tenant
    const employees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('user.tenant_id = :tenantId', { tenantId })
      .getMany();

    // Get all leave types for the tenant
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { tenantId, status: 'active' },
    });

    // Get all leaves for the current year
    const employeeIds = employees.map(emp => emp.user_id);
    const leaves = await this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.leaveType', 'leaveType')
      .leftJoinAndSelect('leave.employee', 'employee')
      .where('leave.startDate BETWEEN :startDate AND :endDate', { startDate: startOfYear, endDate: endOfYear })
      .andWhere('leave.employeeId IN (:...employeeIds)', { employeeIds })
      .getMany();

    // Group leaves by employee
    const leavesByEmployee = leaves.reduce((acc, leave) => {
      if (!acc[leave.employeeId]) {
        acc[leave.employeeId] = [];
      }
      acc[leave.employeeId].push(leave);
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
            remainingDays: Math.max(0, leaveType.maxDaysPerYear - approvedDays),
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

    // Calculate organization-wide statistics
    const orgStats = {
      totalEmployees: employees.length,
      employeesOnLeave: employeeReports.filter(emp => emp.totals.approvedLeaveDays > 0).length,
      totalLeaveDays: employeeReports.reduce((sum, emp) => sum + emp.totals.approvedLeaveDays, 0),
      totalPendingDays: employeeReports.reduce((sum, emp) => sum + emp.totals.pendingLeaveDays, 0),
      totalLeaveRequests: employeeReports.reduce((sum, emp) => sum + emp.totals.totalLeaveRequests, 0),
      approvedRequests: employeeReports.reduce((sum, emp) => sum + emp.totals.approvedRequests, 0),
      pendingRequests: employeeReports.reduce((sum, emp) => sum + emp.totals.pendingRequests, 0),
      rejectedRequests: employeeReports.reduce((sum, emp) => sum + emp.totals.rejectedRequests, 0),
    };

    return {
      period: {
        year: currentYear,
        startDate: startOfYear,
        endDate: endOfYear,
      },
      organizationStats: orgStats,
      employeeReports,
      leaveTypes: leaveTypes.map(lt => ({
        id: lt.id,
        name: lt.name,
        maxDaysPerYear: lt.maxDaysPerYear,
        carryForward: lt.carryForward,
      })),
    };
  }
}
