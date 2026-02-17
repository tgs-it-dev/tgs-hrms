import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Query,
  Put,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { EmployeeBenefitsService } from "./employee-benefits.service";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { RolesGuard } from "src/common/guards/roles.guard";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { CreateEmployeeBenefitDto } from "../dto/employee-benefit/create-employee-benefit.dto";
import { TenantId } from "src/common/decorators/company.deorator";
import { JwtUserPayloadDto } from "src/modules/auth/dto/jwt-payload.dto";
import { EmployeeBenefitSummaryDto } from "../dto/employee-benefit/employee-benefit-summary.dto";
import {
  PaginatedGetAllEmployeesWithBenefitsResponseDto,
} from "../dto/employee-benefit/get-all-employees-with-benefits.dto";

@ApiTags("Employee Benefits")
@Controller("employee-benefits")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeBenefitsController {
  constructor(
    private readonly employeeBenefitsService: EmployeeBenefitsService,
  ) { }

  @Post()
  @Roles("hr-admin", 'admin')
  @ApiOperation({ summary: "Assign a benefit to an employee" })
  async create(
    @TenantId() tenant_id: string,
    @Req() req: any,
    @Body() dto: CreateEmployeeBenefitDto,
  ) {
    // date range validation
    if (dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);

      if (end <= start) {
        throw new BadRequestException("endDate must be after startDate");
      }
    }

    const assignedBy: string = (req as { user: JwtUserPayloadDto }).user.id;

    return this.employeeBenefitsService.create(tenant_id, assignedBy, dto);
  }

  @Get()
  @Roles("hr-admin", "network-admin", "employee", 'manager')
  @ApiOperation({
    summary: "Get benefits assigned to a specific employee (by employeeId)",
  })
  @ApiQuery({
    name: "employeeId",
    required: true,
    description: "Filter by specific employee ID",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Page number for pagination",
  })
  async findAll(
    @TenantId() tenant_id: string,
    @Query("employeeId") employeeId: string,
    @Query("page") page: number = 1,
  ) {
    // Only show benefits for the requested employeeId
    return this.employeeBenefitsService.findAll(tenant_id, employeeId, page);
  }

  @Put(":id/cancel")
  @Roles("hr-admin", 'admin')
  @ApiOperation({ summary: "Cancel an employee benefit" })
  async cancel(@TenantId() tenant_id: string, @Param("id") id: string) {
    return this.employeeBenefitsService.cancel(tenant_id, id);
  }

  @Get("employees")
  @Roles("hr-admin", "network-admin", "system-admin")
  @ApiOperation({
    summary:
      "Get all employees with their assigned benefits (HR Admin/System Admin view)",
  })
  @ApiOkResponse({
    type: PaginatedGetAllEmployeesWithBenefitsResponseDto,
    description: "List of all employees with their assigned benefits",
  })
  async getAllEmployeesWithBenefits(
    @TenantId() tenant_id: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 25,
  ) {
    return this.employeeBenefitsService.getAllEmployeesWithBenefits(
      tenant_id,
      page,
      limit,
    );
  }

  @Get("summary")
  @Roles("network-admin", "system-admin")
  @ApiOperation({
    summary: "Get summary for benefits coverage (Network Admin/System Admin)",
  })
  @ApiQuery({
    name: "tenant_id",
    required: false,
    description: "Optional tenant ID (System Admin only - when provided, stats for that tenant; otherwise all tenants)",
  })
  @ApiOkResponse({
    type: EmployeeBenefitSummaryDto,
    description: "Summary statistics of employee benefits coverage",
  })
  async getSummary(
    @TenantId() tenant_id: string,
    @Query("tenant_id") tenantIdQuery?: string,
    @Req() req?: { user?: { role?: string } },
  ) {
    const isSystemAdmin = req?.user?.role === "system-admin";
    if (isSystemAdmin) {
      const result = await this.employeeBenefitsService.getSystemAdminSummary(tenantIdQuery);
      return {
        totalActiveBenefits: result.totalActiveBenefits,
        mostCommonBenefitType: result.mostCommonBenefitType,
        totalEmployeesCovered: result.totalEmployeesCovered,
      };
    }
    return this.employeeBenefitsService.getSummary(tenant_id);
  }

  // System Admin Dedicated Endpoints
  @Get("system-admin/summary")
  @Roles("system-admin")
  @ApiOperation({
    summary: "Get benefits summary for System Admin (all tenants or specific tenant)",
  })
  @ApiQuery({
    name: "tenant_id",
    required: false,
    description: "Optional tenant ID to filter by specific tenant",
  })
  @ApiOkResponse({
    description: "Summary statistics of employee benefits coverage",
  })
  async getSystemAdminSummary(@Query("tenant_id") tenant_id?: string) {
    return this.employeeBenefitsService.getSystemAdminSummary(tenant_id);
  }

  @Get("all-tenants")
  @Roles("system-admin")
  @ApiOperation({
    summary: "Get all employees with benefits across all tenants with tenant filter (System Admin only)",
  })
  @ApiQuery({
    name: "tenant_id",
    required: false,
    description: "Optional tenant ID to filter by",
    type: String,
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Page number for pagination (default: 1)",
    type: Number,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Items per page (default: 25, max: 100)",
    type: Number,
  })
  @ApiOkResponse({
    description: "Returns paginated employees grouped by tenant with their benefits",
  })
  async getAllEmployeesWithBenefitsAcrossTenants(
    @Query("tenant_id") tenantId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || "1", 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit || "25", 10) || 25));

    return this.employeeBenefitsService.getAllEmployeesWithBenefitsAcrossTenants(
      tenantId,
      pageNumber,
      limitNumber,
    );
  }
}
