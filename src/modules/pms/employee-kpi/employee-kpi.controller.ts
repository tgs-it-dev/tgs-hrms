import {
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
  @ApiOperation({ summary: "Assign a KPI for an employee" })
  @ApiResponse({
    status: 201,
    description: "Employee KPI created successfully.",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid data or tenant ID.",
  })
  create(@TenantId() tenantId: string, @Body() dto: CreateEmployeeKpiDto) {
    return this.employeeKpiService.create(tenantId, dto);
  }

  /**
   * Update an employee KPI record
   */
  @Put(":id")
  @Roles("manager", "hr-admin")
  @ApiOperation({ summary: "Update an existing employee KPI" })
  @ApiResponse({
    status: 200,
    description: "Employee KPI updated successfully.",
  })
  @ApiResponse({ status: 404, description: "Employee KPI not found." })
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeKpiDto,
  ) {
    return this.employeeKpiService.update(tenantId, id, dto);
  }

  /**
   * Get list of employee KPIs (optionally filtered by employeeId and cycle)
   */
  @Get()
  @Roles("employee", "manager", "hr-admin")
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
  @Roles("employee", "manager", "hr-admin")
  @ApiOperation({
    summary:
      "Calculate total weighted performance score for an employee per cycle",
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
    @Query("cycle") cycle: string,
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
}
