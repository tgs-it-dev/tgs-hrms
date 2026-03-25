import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { TenantGuard } from "src/common/guards/tenant.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { TenantId } from "src/common/decorators/company.deorator";
import { EmployeeKpiService } from "./employee-kpi.service";
import { CreateEmployeeKpiDto } from "../dtos/employee-kpi/create-employee-kpi.dto";
import { UpdateEmployeeKpiDto } from "../dtos/employee-kpi/update-employee-kpi.dto";
import { JwtUserPayloadDto } from "src/modules/auth/dto/jwt-payload.dto";

@ApiTags("Employee KPIs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller("employee-kpis")
export class EmployeeKpiController {
  constructor(private readonly employeeKpiService: EmployeeKpiService) {}

  /**
   * Create a new employee KPI record
   */
  @Post()
  @Roles("manager", "hr-admin")
  @ApiOperation({ summary: "Assign a KPI for an employee. Managers can only assign to their team members." })
  @ApiResponse({
    status: 201,
    description: "Employee KPI created successfully.",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid data or tenant ID.",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Managers can only assign KPIs to employees in their teams.",
  })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateEmployeeKpiDto,
    @Req() req: any,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;
    return this.employeeKpiService.create(
      tenantId,
      dto,
      user.id,
      user.role,
    );
  }

  /**
   * Update an employee KPI record
   */
  @Put(":id")
  @Roles("manager", "hr-admin")
  @ApiOperation({ summary: "Update an existing employee KPI. Managers can only update KPIs of their team members." })
  @ApiResponse({
    status: 200,
    description: "Employee KPI updated successfully.",
  })
  @ApiResponse({ status: 404, description: "Employee KPI not found." })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Managers can only update KPIs of employees in their teams.",
  })
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeKpiDto,
    @Req() req: any,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;
    return this.employeeKpiService.update(
      tenantId,
      id,
      dto,
      user.id,
      user.role,
    );
  }

  /**
   * Get list of employee KPIs (optionally filtered by employeeId and cycle)
   */
  @Get()
  @Roles("employee", "manager", "hr-admin", "admin")
  @ApiOperation({
    summary:
      "Get all employee KPIs for a tenant (filterable by employeeId and reviewCycle)",
  })
  @ApiResponse({
    status: 200,
    description: "List of employee KPIs for the tenant.",
  })
  @ApiQuery({
    name: "employeeId",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "cycle",
    type: String,
    required: false,
  })
  findAll(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Query("employeeId") employeeId?: string,
    @Query("cycle") cycle?: string,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;

    if (user.role === "employee") {
      // Employee can only view their own kpis
      if (employeeId && employeeId !== user.id) {
        throw new ForbiddenException(
          "You are not allowed to view other employees' kpis",
        );
      }

      // Always force their own ID
      return this.employeeKpiService.findAllByTenant(tenantId, user.id, cycle);
    } else {
      // HR Admin / Manager: can view any employee’s kpis (optionally filter by employeeId)
      return this.employeeKpiService.findAllByTenant(
        tenantId,
        employeeId,
        cycle,
      );
    }
  }

  /**
   * Calculate KPI summary (weighted score) for a given employee and cycle
   */
  @Get("summary")
  @Roles("employee", "manager", "hr-admin", "admin")
  @ApiOperation({
    summary:
      "Calculate total weighted performance score for an employee per cycle",
  })
  @ApiQuery({
    name: "cycle",
    type: String,
    required: false,
    description: "Review cycle (e.g., Q4-2025). If not provided, returns summary for all cycles.",
  })
  @ApiResponse({
    status: 200,
    description: "Performance summary calculated successfully.",
    schema: {
      example: {
        employeeId: "user_456",
        cycle: "Q4-2025",
        totalScore: 92.5,
        recordCount: 4,
      },
    },
  })
  async getSummary(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Query("employeeId") employeeId: string,
    @Query("cycle") cycle?: string,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;

    if (user.role === "employee") {
      // Employee can only view their own kpis
      if (employeeId && employeeId !== user.id) {
        throw new ForbiddenException(
          "You are not allowed to view other employees' kpi summary",
        );
      }

      // Always force their own ID
      return this.employeeKpiService.getSummary(tenantId, user.id, cycle);
    } else {
      // HR Admin / Manager: can view any employee’s kpis (optionally filter by employeeId)
      return this.employeeKpiService.getSummary(tenantId, employeeId, cycle);
    }
  }

  /**
   * Get KPIs for all team members (Manager only)
   */
  @Get("team")
  @Roles("manager")
  @ApiOperation({
    summary: "Get all employee KPIs for manager's team members",
  })
  @ApiQuery({
    name: "cycle",
    type: String,
    required: false,
    description: "Filter by review cycle (e.g., Q4-2025)",
  })
  @ApiResponse({
    status: 200,
    description: "List of employee KPIs for team members.",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Manager role required or no teams assigned",
  })
  async getTeamEmployeeKpis(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Query("cycle") cycle?: string,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;
    return this.employeeKpiService.getTeamEmployeeKpis(
      user.id,
      tenantId,
      cycle,
    );
  }

  /**
   * Get KPI summary for all team members (Manager only)
   */
  @Get("team/summary")
  @Roles("manager")
  @ApiOperation({
    summary:
      "Get KPI summary (weighted performance scores) for all team members per cycle",
  })
  @ApiQuery({
    name: "cycle",
    type: String,
    required: false,
    description: "Review cycle (e.g., Q4-2025). If not provided, returns summary for all cycles.",
  })
  @ApiResponse({
    status: 200,
    description: "KPI summaries for all team members.",
    schema: {
      example: [
        {
          employeeId: "employee-uuid",
          employeeName: "John Doe",
          employeeEmail: "john.doe@company.com",
          cycle: "Q4-2025",
          totalScore: 92.5,
          recordCount: 4,
          kpis: [
            {
              kpiId: "kpi-uuid",
              kpiTitle: "Customer Satisfaction",
              targetValue: 80,
              achievedValue: 85,
              score: 4.5,
              weight: 30,
              weightedScore: 1.35,
            },
          ],
        },
      ],
    },
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Manager role required or no teams assigned",
  })
  async getTeamEmployeeKpiSummary(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Query("cycle") cycle?: string,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;
    return this.employeeKpiService.getTeamEmployeeKpiSummary(
      user.id,
      tenantId,
      cycle,
    );
  }
}
