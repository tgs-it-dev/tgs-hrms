import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LeaveReportsService } from './leave-reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

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
}
