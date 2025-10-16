import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly leaveReportsService: LeaveReportsService) {}

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
    @Request() req: any
  ) {
    return this.leaveReportsService.getLeaveBalance(employeeId, req.user.tenant_id);
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
    @Request() req: any,
    @Res() res: Response,
  ) {
    const data = await this.leaveReportsService.getLeaveBalance(employeeId, req.user.tenant_id);
    const rows = (data.balances || []).map(row => ({
      employeeId: data.employeeId,
      year: data.year,
      ...row
    }));
    return sendCsvResponse(res, 'leave-balance.csv', rows);
  }
}
