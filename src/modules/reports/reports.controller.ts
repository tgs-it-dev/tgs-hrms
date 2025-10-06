import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // New 30-day attendance summary for all active employees in a tenant
  @Get('attendance-summary')
  @UseGuards(RolesGuard)
  @Roles('hr-admin', 'system-admin', 'network-admin')
  @ApiOperation({ summary: 'Get N-day attendance summary for active employees in tenant' })
  @ApiQuery({ name: 'days', required: false, example: 30, description: 'Number of days to include (default 30)' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Target tenant (admin/network-admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number (default 1)' })
  @ApiResponse({ status: 200, description: 'Paginated list of attendance summaries per employee' })
  async attendanceSummary(
    @Req() req: any,
    @Query('days') days?: string,
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: string
  ) {
    const numDays = Math.max(1, parseInt(days || '30', 10) || 30);
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const requesterRole = (req.user?.role || '').toLowerCase();
    const effectiveTenantId = tenantId && (requesterRole === 'system-admin' || requesterRole === 'network-admin')
      ? tenantId
      : req.user?.tenant_id;
    return (this.reportsService as any).getAttendanceSummaryLastDays(effectiveTenantId, numDays, pageNumber);
  }

  @Get('leave-summary')
  @ApiOperation({ summary: 'Get leave summary for users' })
  @ApiQuery({ name: 'userId', required: false, description: 'Specific user ID to get summary for' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number (default 1)' })
  @ApiResponse({ status: 200, description: 'Paginated leave summary information' })
  async leaveSummary(@Query('userId') userId?: string, @Query('page') page?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.reportsService.getLeaveSummary(userId, pageNumber);
  }

  @Get('headcount')
  @ApiOperation({ summary: 'Get organizational headcount statistics' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number (default 1)' })
  @ApiResponse({ status: 200, description: 'Paginated headcount statistics by department, designation, and tenant' })
  async headcount(@Query('page') page?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.reportsService.getHeadcount(pageNumber);
  }
}