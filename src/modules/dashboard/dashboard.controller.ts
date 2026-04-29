import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { TenantId } from "../../common/decorators/company.deorator";

@ApiTags("Dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("kpi")
  @Roles("admin", "system-admin", "network-admin", "hr-admin", "manager", "employee")
  @ApiOperation({ summary: "Get top-level KPI metrics for dashboard cards" })
  @ApiResponse({
    status: 200,
    description: "KPI metrics ready for direct display",
  })
  async getKpi(@TenantId() tenantId: string, @Req() req: { user: { id: string; role: string } }) {
    return this.dashboardService.getKpiMetrics({
      tenantId,
      userId: req.user.id,
      role: req.user.role,
    });
  }

  @Get("employee-growth")
  @Roles("admin", "system-admin", "network-admin", "hr-admin", "manager")
  @ApiOperation({
    summary: "Get employee growth over time (monthly cumulative totals)",
  })
  @ApiResponse({
    status: 200,
    description: "Employee growth series",
  })
  async getEmployeeGrowth(@TenantId() tenantId: string) {
    return this.dashboardService.getEmployeeGrowth(tenantId);
  }

  @Get("attendance-summary")
  @Roles("admin", "system-admin", "network-admin", "hr-admin", "manager")
  @ApiOperation({
    summary: "Get department-wise attendance summary for a given date",
  })
  @ApiQuery({
    name: "date",
    required: false,
    type: String,
    description: "ISO date string (e.g. 2025-01-15). Defaults to today.",
  })
  async getAttendanceSummary(
    @TenantId() tenantId: string,
    @Req() req: { user: { id: string; role: string } },
    @Query("date") date?: string,
  ) {
    return this.dashboardService.getAttendanceSummary({
      tenantId,
      userId: req.user.id,
      role: req.user.role,
      date,
    });
  }

  @Get("employee-availability")
  @Roles("admin", "system-admin", "network-admin", "hr-admin", "manager")
  @ApiOperation({
    summary: "Get gender distribution and active vs inactive employees",
  })
  async getEmployeeAvailability(@TenantId() tenantId: string) {
    return this.dashboardService.getEmployeeAvailability(tenantId);
  }

  @Get("alerts")
  @Roles("admin", "system-admin", "network-admin", "hr-admin", "manager", "employee")
  @ApiOperation({
    summary: "Get dashboard alerts (auto checkouts, pending approvals)",
  })
  async getAlerts(
    @TenantId() tenantId: string,
    @Req() req: { user: { id: string; role: string } },
  ) {
    return this.dashboardService.getAlerts({
      tenantId,
      userId: req.user.id,
      role: req.user.role,
    });
  }
}
