import { Controller, Post, Get, UseGuards, Req, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { TimesheetService } from './timesheet.service';
import { AuthenticatedRequest } from '../../common/types/request.types';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';

@ApiTags('Timesheet')
@ApiBearerAuth()
@Controller('timesheet')
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start work timer' })
  @ApiResponse({ status: 201, description: 'Work timer started successfully' })
  async start(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.timesheetService.startWork(userId);
  }

  @Post('end')
  @ApiOperation({ summary: 'End work timer' })
  @ApiResponse({ status: 200, description: 'Work timer ended successfully' })
  async end(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.timesheetService.endWork(userId);
  }

  @Get()
  @ApiOperation({ summary: 'List timesheet sessions for a user' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated timesheet sessions',
  })
  async list(@Req() req: AuthenticatedRequest, @Query('page') page?: string) {
    const userId = req.user.id;
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.timesheetService.list(userId, pageNumber);
  }

  @Get('summary')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin', 'manager')
  @Permissions('manage_timesheets', 'view_team_timesheets')
  @ApiOperation({
    summary: 'Get tenant-wide timesheet summary (Admin/Manager only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated timesheet summary for all employees',
  })
  async summary(
    @Req() req: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
  ) {
    const tenantId: string = req.user.tenant_id;
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.timesheetService.summaryByTenant(
      tenantId,
      from,
      to,
      pageNumber,
    );
  }
}
