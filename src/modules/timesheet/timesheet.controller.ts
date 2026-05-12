import { Controller, Post, Get, UseGuards, Req, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TimesheetService } from './timesheet.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { TimesheetListQueryDto } from './dto/timesheet-list-query.dto';
import { TimesheetSummaryQueryDto } from './dto/timesheet-summary-query.dto';

interface AuthedRequest {
  user: { id: string; tenant_id: string };
}

@ApiTags('Timesheet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timesheet')
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start work timer' })
  @ApiResponse({ status: 201, description: 'Work timer started successfully' })
  async start(@Req() req: AuthedRequest) {
    return this.timesheetService.startWork(req.user.id);
  }

  @Post('end')
  @ApiOperation({ summary: 'End work timer' })
  @ApiResponse({ status: 200, description: 'Work timer ended successfully' })
  async end(@Req() req: AuthedRequest) {
    return this.timesheetService.endWork(req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List timesheet sessions for current user' })
  @ApiResponse({ status: 200, description: 'Returns paginated timesheet sessions' })
  async list(@Req() req: AuthedRequest, @Query() query: TimesheetListQueryDto) {
    return this.timesheetService.list(req.user.id, query.page ?? 1);
  }

  @Get('summary')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin', 'manager')
  @Permissions('manage_timesheets', 'view_team_timesheets')
  @ApiOperation({ summary: 'Get tenant-wide timesheet summary (Admin/Manager only)' })
  @ApiResponse({ status: 200, description: 'Returns paginated timesheet summary for all employees' })
  async summary(
    @Req() req: AuthedRequest,
    @Query() query: TimesheetSummaryQueryDto,
  ) {
    return this.timesheetService.summaryByTenant(
      req.user.tenant_id,
      query.from,
      query.to,
      query.page ?? 1,
    );
  }
}
