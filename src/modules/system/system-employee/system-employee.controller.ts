import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { SystemEmployeeService } from "./system-employee.service";

@ApiTags("System (Employees)")
@Controller("system/employees")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("system-admin")
export class SystemEmployeeController {
  constructor(private readonly systemEmployeeService: SystemEmployeeService) {}

  @Get()
  @ApiOperation({
    summary:
      "Get paginated list of employees across all tenants (System Admin)",
  })
  @ApiQuery({ name: "tenantId", required: false })
  @ApiQuery({ name: "departmentId", required: false })
  @ApiQuery({ name: "designationId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, default: 1 })
  async findAll(
    @Query("tenantId") tenantId?: string,
    @Query("departmentId") departmentId?: string,
    @Query("designationId") designationId?: string,
    @Query("status") status?: string,
    @Query("page") page: number = 1,
  ) {
    const data = await this.systemEmployeeService.findAll(page, {
      tenantId,
      departmentId,
      designationId,
      status,
    });

    return data;
  }

  @Get("leaves")
  @ApiOperation({
    summary: "Get employee leave history (System Admin) - Both employeeId and userId are optional",
  })
  @ApiQuery({
    name: "employeeId",
    required: false,
    description: "Employee ID (UUID) - Optional filter",
    type: String,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "User ID (UUID) - Optional filter",
    type: String,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getLeaves(
    @Query("employeeId") employeeId?: string,
    @Query("userId") userId?: string,
  ) {
    const data = await this.systemEmployeeService.getLeaves(employeeId, userId);
    return data;
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get full employee profile (System Admin)",
  })
  async findProfile(@Param("id") id: string) {
    const data = await this.systemEmployeeService.findProfile(id);
    return data;
  }

  @Get(":id/leaves")
  @ApiOperation({
    summary: "Get employee leave history by employee ID (System Admin) - Legacy route",
  })
  @ApiParam({
    name: "id",
    description: "Employee ID (UUID)",
    type: String,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "User ID (UUID) - Optional filter",
    type: String,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getLeavesByEmployeeId(
    @Param("id") id: string,
    @Query("userId") userId?: string,
  ) {
    const data = await this.systemEmployeeService.getLeaves(id, userId);
    return data;
  }

  @Get(":id/performance")
  @ApiOperation({
    summary: "Get employee KPI performance records (System Admin)",
  })
  async getPerformance(@Param("id") id: string) {
    const data = await this.systemEmployeeService.getPerformance(id);
    return data;
  }

  @Get(":id/assets")
  @ApiOperation({
    summary: "Get employee assigned assets (System Admin)",
  })
  async getAssets(@Param("id") id: string) {
    const data = await this.systemEmployeeService.getAssets(id);
    return data;
  }
}
