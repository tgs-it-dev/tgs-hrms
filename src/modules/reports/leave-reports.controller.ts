import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LeaveReportsService } from './leave-reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Response } from 'express';
import { sendCsvResponse } from '../../common/utils/csv.util';

@ApiTags('Leave Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class LeaveReportsController {
  constructor(private readonly leaveReportsService: LeaveReportsService) { }

  @Get('leave-summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get yearly summary of leaves used by an employee' })
  @ApiResponse({
    status: 200,
    description: 'Returns yearly leave summary',
    schema: {
      example: {
        employeeId: 'user_123',
        year: 2025,
        summary: [
          { type: 'Annual', used: 10, remaining: 14 },
          { type: 'Sick', used: 4, remaining: 6 }
        ]
      }
    }
  })
  async getLeaveSummary(
    @Query('employeeId') employeeId: string,
    @Query('year') year: string,
    @Request() req: any
  ) {
    const yearNumber = parseInt(year || new Date().getFullYear().toString(), 10);
    return this.leaveReportsService.getLeaveSummary(employeeId, yearNumber, req.user.tenant_id);
  }

  @Get('team-leave-summary')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager', 'hr-admin', 'admin', 'system-admin')
  @Permissions('view_team_reports')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Show summary for all employees under a manager' })
  @ApiResponse({
    status: 200,
    description: 'Returns team leave summary',
  })
  async getTeamLeaveSummary(
    @Query('managerId') managerId: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Request() req: any
  ) {
    const monthNumber = parseInt(month || new Date().getMonth().toString(), 10);
    const yearNumber = parseInt(year || new Date().getFullYear().toString(), 10);
    return this.leaveReportsService.getTeamLeaveSummary(managerId, monthNumber, yearNumber, req.user.tenant_id);
  }

  @Get('leave-balance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate remaining leave balance by type' })
  @ApiResponse({
    status: 200,
    description: 'Returns leave balance for employee',
  })
  async getLeaveBalance(
    @Query('employeeId') employeeId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Request() req: any
  ) {
    const yearNumber = year ? parseInt(year, 10) : undefined;
    const monthNumber = month ? parseInt(month, 10) : undefined;
    return this.leaveReportsService.getLeaveBalance(
      employeeId,
      req.user.tenant_id,
      yearNumber,
      monthNumber,
    );
  }

  // CSV Export: Yearly leave summary for employee
  @Get('leave-summary/export')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export yearly leave summary as CSV' })
  async exportLeaveSummary(
    @Query('employeeId') employeeId: string,
    @Query('year') year: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const yearNumber = parseInt(year || new Date().getFullYear().toString(), 10);
    const data = await this.leaveReportsService.getLeaveSummary(employeeId, yearNumber, req.user.tenant_id);
    const rows = (data.summary || []).map(row => ({
      employeeId: data.employeeId,
      year: data.year,
      ...row
    }));
    return sendCsvResponse(res, 'leave-summary.csv', rows);
  }

  // CSV Export: Team-leave summary
  @Get('team-leave-summary/export')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager', 'hr-admin', 'admin', 'system-admin')
  @Permissions('view_team_reports')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export team leave summary as CSV' })
  async exportTeamLeaveSummary(
    @Query('managerId') managerId: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const monthNumber = parseInt(month || new Date().getMonth().toString(), 10);
    const yearNumber = parseInt(year || new Date().getFullYear().toString(), 10);
    const data = await this.leaveReportsService.getTeamLeaveSummary(managerId, monthNumber, yearNumber, req.user.tenant_id);
    const rows: any[] = [];
    for (const member of data.teamMembers) {
      (member.leaves || []).forEach(leave => {
        rows.push({
          managerId: data.managerId,
          month: data.month,
          year: data.year,
          employeeId: member.employeeId,
          name: member.name,
          email: member.email,
          department: member.department,
          designation: member.designation,
          leaveType: leave.type,
          days: leave.days,
          startDate: leave.startDate,
          endDate: leave.endDate,
        });
      });
      if ((member.leaves || []).length === 0) {
        rows.push({
          managerId: data.managerId,
          month: data.month,
          year: data.year,
          employeeId: member.employeeId,
          name: member.name,
          email: member.email,
          department: member.department,
          designation: member.designation,
          leaveType: '',
          days: 0,
          startDate: '',
          endDate: '',
        });
      }
    }
    return sendCsvResponse(res, 'team-leave-summary.csv', rows);
  }

  // CSV Export: Leave balance for employee
  @Get('leave-balance/export')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export leave balance as CSV' })
  async exportLeaveBalance(
    @Query('employeeId') employeeId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const yearNumber = year ? parseInt(year, 10) : undefined;
    const monthNumber = month ? parseInt(month, 10) : undefined;
    const data = await this.leaveReportsService.getLeaveBalance(
      employeeId,
      req.user.tenant_id,
      yearNumber,
      monthNumber,
    );
    const rows = (data.balances || []).map(row => ({
      employeeId: data.employeeId,
      year: data.year,
      ...row
    }));
    return sendCsvResponse(res, 'leave-balance.csv', rows);
  }

  // Comprehensive Leave Reports for Admin, HR-Admin, and System-Admin
  @Get('all-leave-reports')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'hr-admin', 'system-admin')
  @Permissions('view_leave_reports')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get comprehensive leave reports for all employees (paginated)',
    description: 'Returns detailed leave reports for the specified year (or current year if not provided) including employee summaries, leave records, and organization statistics. Accessible by admin, hr-admin, and system-admin roles. Supports pagination via page query parameter and filtering by year and month.'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Filter by year (e.g., 2025). If not provided, uses current year.' })
  @ApiQuery({ name: 'employeeName', required: false, type: String, description: 'Filter by employee full name (first name + last name, e.g. "Alex Parker"). Pass the complete name to match exactly one employee.' })
  @ApiResponse({
    status: 200,
    description: 'Returns comprehensive leave reports with pagination',
    schema: {
      example: {
        period: {
          year: 2025,
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-12-31T23:59:59.999Z'
        },
        organizationStats: {
          totalEmployees: 50,
          employeesOnLeave: 12,
          totalLeaveDays: 120,
          totalPendingDays: 15,
          totalLeaveRequests: 45,
          approvedRequests: 35,
          pendingRequests: 8,
          rejectedRequests: 2
        },
        employeeReports: {
          items: [
            {
              employeeId: 'emp_123',
              employeeName: 'John Doe',
              email: 'john.doe@company.com',
              department: 'Engineering',
              designation: 'Senior Developer',
              leaveSummary: [
                {
                  leaveTypeId: 'lt_1',
                  leaveTypeName: 'Annual Leave',
                  totalDays: 10,
                  approvedDays: 8,
                  pendingDays: 2,
                  rejectedDays: 0,
                  maxDaysPerYear: 20,
                  remainingDays: 12
                }
              ],
              leaveRecords: [
                {
                  id: 'leave_123',
                  leaveTypeName: 'Annual Leave',
                  startDate: '2025-01-15',
                  endDate: '2025-01-20',
                  totalDays: 5,
                  status: 'APPROVED',
                  reason: 'Family vacation',
                  appliedDate: '2025-01-10T09:00:00.000Z',
                  approvedBy: 'manager_123',
                  approvedDate: '2025-01-11T14:30:00.000Z'
                }
              ],
              totals: {
                totalLeaveDays: 10,
                approvedLeaveDays: 8,
                pendingLeaveDays: 2,
                totalLeaveRequests: 3,
                approvedRequests: 2,
                pendingRequests: 1,
                rejectedRequests: 0
              }
            }
          ],
          total: 50,
          page: 1,
          limit: 25,
          totalPages: 2
        },
        leaveTypes: [
          {
            id: 'lt_1',
            name: 'Annual Leave',
            maxDaysPerYear: 20,
            carryForward: true
          }
        ]
      }
    }
  })
  async getAllLeaveReports(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('year') year?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedYear = year ? parseInt(year, 10) : undefined;
    return this.leaveReportsService.getAllLeaveReports(
      req.user.tenant_id,
      parsedPage,
      parsedYear,
      employeeName,
    );
  }
}
