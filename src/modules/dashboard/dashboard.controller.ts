import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/company.deorator';
import { DashboardAttendanceQueryDto } from './dto/dashboard-attendance-query.dto';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(TenantGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpi')
  @Roles(
    'admin',
    'system-admin',
    'network-admin',
    'hr-admin',
    'manager',
    'employee',
  )
  @ApiOperation({ summary: 'Get top-level KPI metrics for dashboard cards' })
  @ApiResponse({
    status: 200,
    description: 'KPI metrics ready for direct display',
  })
  async getKpi(@TenantId() tenantId: string, @Req() req: AuthenticatedRequest) {
    return this.dashboardService.getKpiMetrics({
      tenantId,
      userId: req.user.id,
      role: req.user.role,
    });
  }

  @Get('employee-growth')
  @Roles('admin', 'system-admin', 'network-admin', 'hr-admin', 'manager')
  @ApiOperation({
    summary: 'Get employee growth over time (monthly cumulative totals)',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee growth series',
  })
  async getEmployeeGrowth(@TenantId() tenantId: string) {
    return this.dashboardService.getEmployeeGrowth(tenantId);
  }

  @Get('attendance-summary')
  @Roles('admin', 'system-admin', 'network-admin', 'hr-admin', 'manager')
  @ApiOperation({
    summary: 'Get department-wise attendance summary for a given date',
  })
  @ApiResponse({
    status: 200,
    description: 'Department attendance summary',
  })
  async getAttendanceSummary(
    @TenantId() tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: DashboardAttendanceQueryDto,
  ) {
    return this.dashboardService.getAttendanceSummary({
      tenantId,
      userId: req.user.id,
      role: req.user.role,
      date: query.date,
    });
  }

  @Get('employee-availability')
  @Roles('admin', 'system-admin', 'network-admin', 'hr-admin', 'manager')
  @ApiOperation({
    summary: 'Get gender distribution and active vs inactive employees',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee availability breakdown',
  })
  async getEmployeeAvailability(@TenantId() tenantId: string) {
    return this.dashboardService.getEmployeeAvailability(tenantId);
  }

  @Get('alerts')
  @Roles(
    'admin',
    'system-admin',
    'network-admin',
    'hr-admin',
    'manager',
    'employee',
  )
  @ApiOperation({
    summary: 'Get dashboard alerts (auto checkouts, pending approvals)',
  })
  @ApiResponse({ status: 200, description: 'Dashboard alerts' })
  async getAlerts(
    @TenantId() tenantId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dashboardService.getAlerts({
      tenantId,
      userId: req.user.id,
      role: req.user.role,
    });
  }
}
