import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../common/types/request.types';
import { Response } from 'express';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance-summary')
  @UseGuards(RolesGuard)
  @Roles('hr-admin', 'system-admin', 'network-admin')
  @ApiOperation({
    summary:
      'Get attendance summary for all active employees for current month (default) or last X days',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description:
      'If provided, returns summary for last X days (from today, inclusive). If not provided, returns current month (1st to today).',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number (default 1)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Attendance summary for the selected range. Each item: employeeName, workingDays, presents, absents, informedLeaves, department, designation.',
  })
  async attendanceSummary(
    @Req() req: AuthenticatedRequest,
    @Query('days') days?: string,
    @Query('page') page?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const effectiveTenantId = req.user.tenant_id;
    const daysNum = days ? parseInt(days, 10) : undefined;
    return this.reportsService.getAttendanceSummaryWithDays(
      effectiveTenantId,
      daysNum,
      pageNumber,
    );
  }

  @Get('leave-summary')
  @ApiOperation({ summary: 'Get leave summary for users' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Specific user ID to get summary for',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number (default 1)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated leave summary information',
  })
  async leaveSummary(
    @Query('userId') userId?: string,
    @Query('page') page?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.reportsService.getLeaveSummary(userId, pageNumber);
  }

  @Get('headcount')
  @ApiOperation({ summary: 'Get organizational headcount statistics' })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number (default 1)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated headcount statistics by department, designation, and tenant',
  })
  async headcount(@Query('page') page?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.reportsService.getHeadcount(pageNumber);
  }

  // ── CSV export endpoints ──────────────────────────────────────────────────

  @Get('attendance')
  @UseGuards(RolesGuard)
  @Roles('hr-admin', 'admin', 'system-admin', 'network-admin')
  @ApiOperation({
    summary: 'Export attendance records as CSV for payroll reconciliation',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description:
      'Start date (YYYY-MM-DD). Defaults to first day of current month.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description:
      'End date (YYYY-MM-DD). Defaults to last day of current month.',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'Response format. Use "csv" to download.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file with attendance records.',
  })
  async attendanceCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    const csv = await this.reportsService.getAttendanceCsv(
      req.user.tenant_id,
      from,
      to,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="attendance-report.csv"',
    );
    res.send(csv);
  }

  @Get('leave')
  @UseGuards(RolesGuard)
  @Roles('hr-admin', 'admin', 'system-admin', 'network-admin')
  @ApiOperation({
    summary: 'Export leave records as CSV for payroll reconciliation',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description:
      'Start date (YYYY-MM-DD). Defaults to first day of current month.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description:
      'End date (YYYY-MM-DD). Defaults to last day of current month.',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'Response format. Use "csv" to download.',
  })
  @ApiResponse({ status: 200, description: 'CSV file with leave records.' })
  async leaveCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    const csv = await this.reportsService.getLeaveCsv(
      req.user.tenant_id,
      from,
      to,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="leave-report.csv"',
    );
    res.send(csv);
  }

  @Get('flex-requests')
  @UseGuards(RolesGuard)
  @Roles('hr-admin', 'admin', 'system-admin', 'network-admin')
  @ApiOperation({
    summary:
      'Export WFH and overtime flex-request records as CSV for payroll reconciliation',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description:
      'Start date (YYYY-MM-DD). Defaults to first day of current month.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description:
      'End date (YYYY-MM-DD). Defaults to last day of current month.',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'Response format. Use "csv" to download.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file with WFH and overtime flex-request records.',
  })
  async flexRequestsCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    const csv = await this.reportsService.getFlexRequestsCsv(
      req.user.tenant_id,
      from,
      to,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="flex-requests-report.csv"',
    );
    res.send(csv);
  }
}
