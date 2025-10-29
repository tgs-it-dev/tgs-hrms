import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { TenantId } from "src/common/decorators/company.deorator";
import { SystemService } from "./system.service";
import { Response } from "express";

@ApiTags("System")
@Controller("system")
@Roles("system-admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Get system dashboard summary" })
  @ApiResponse({
    status: 200,
    description:
      "Returns total tenants, active tenants, total employees, uptime, and recent activities.",
  })
  async getDashboardSummary() {
    return this.systemService.getDashboardSummary();
  }

  @Get("logs")
  @ApiOperation({ summary: "Get paginated system logs" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    example: 1,
    description: "Page number for pagination (default: 1)",
  })
  async getSystemLogs(@Query("page") page: number = 1) {
    return this.systemService.getSystemLogs(page);
  }

  @Get("logs/export")
  @ApiOperation({ summary: "Export latest 1000 system logs to CSV" })
  @ApiResponse({
    status: 200,
    description: "Returns CSV file of recent system logs",
  })
  async exportSystemLogs(@Res() res: Response) {
    const csv = await this.systemService.exportSystemLogs();

    if (!csv) {
      throw new NotFoundException("No system logs available for export");
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=system-logs-${Date.now()}.csv`,
    );
    res.send(csv);
  }

  @Get("tenant-growth")
  @ApiOperation({
    summary: "Get tenant growth overview with month-wise cumulative counts",
  })
  @ApiQuery({
    name: "year",
    required: true,
    type: Number,
    example: 2025,
    description: "Year for growth data",
  })
  @ApiQuery({
    name: "tenantId",
    required: true,
    type: String,
    example: "uuid-here",
    description: "Tenant ID for which to fetch growth data",
  })
  @ApiResponse({
    status: 200,
    description:
      "Returns month-wise cumulative growth data for employees, departments, and designations",
    schema: {
      example: [
        {
          tenantId: "uuid-here",
          tenantName: "Company ABC",
          month: "2025-01",
          monthName: "Jan",
          employees: 20,
          departments: 2,
          designations: 5,
        },
        {
          tenantId: "uuid-here",
          tenantName: "Company ABC",
          month: "2025-02",
          monthName: "Feb",
          employees: 25,
          departments: 2,
          designations: 25,
        },
      ],
    },
  })
  async getTenantGrowth(
    @Query("year") year: number,
    @Query("tenantId") tenantId: string,
  ) {
    if (!tenantId) {
      throw new NotFoundException("Tenant ID is required");
    }
    return this.systemService.getTenantGrowthOverview(year, tenantId);
  }
}
