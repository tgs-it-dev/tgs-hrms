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
  ForbiddenException,
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
import { GetAllEmployeesWithBenefitsResponseDto } from "../dto/employee-benefit/get-all-employees-with-benefits.dto";

@ApiTags("Employee Benefits")
@Controller("employee-benefits")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeBenefitsController {
  constructor(
    private readonly employeeBenefitsService: EmployeeBenefitsService,
  ) {}

  @Post()
  @Roles("hr-admin")
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
  @Roles("hr-admin", "network-admin", "employee")
  @ApiOperation({
    summary:
      "Get employee benefits (optionally filtered by employee, department, or designation)",
  })
  @ApiQuery({
    name: "employeeId",
    required: false,
    description: "Filter by specific employee ID",
  })
  @ApiQuery({
    name: "department",
    required: false,
    description: "Filter by department name",
  })
  @ApiQuery({
    name: "designation",
    required: false,
    description: "Filter by designation title",
  })
  async findAll(
    @TenantId() tenant_id: string,
    @Req() req: any,
    @Query("employeeId") employeeId?: string,
    @Query("department") department?: string,
    @Query("designation") designation?: string,
    @Query("page") page: number = 1,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;

    // Employees can only view their own benefits
    if (user.role === "employee" && employeeId && employeeId !== user.id) {
      throw new ForbiddenException(
        "You are not allowed to view other employees' benefits",
      );
    }

    // Determine final filters
    const filters = {
      employeeId,
      department,
      designation,
    };

    return this.employeeBenefitsService.findAll(tenant_id, filters, page);
  }

  @Put(":id/cancel")
  @Roles("hr-admin")
  @ApiOperation({ summary: "Cancel an employee benefit" })
  async cancel(@TenantId() tenant_id: string, @Param("id") id: string) {
    return this.employeeBenefitsService.cancel(tenant_id, id);
  }

  @Get("employees")
  @Roles("hr-admin")
  @ApiOperation({
    summary: "Get all employees with their assigned benefits (HR Admin view)",
  })
  @ApiOkResponse({
    type: [GetAllEmployeesWithBenefitsResponseDto],
    description: "List of all employees with their assigned benefits",
  })
  async getAllEmployeesWithBenefits(
    @TenantId() tenant_id: string,
    @Query("page") page: number = 1,
  ) {
    return this.employeeBenefitsService.getAllEmployeesWithBenefits(
      tenant_id,
      page,
    );
  }

  @Get("summary")
  @Roles("network-admin")
  @ApiOperation({
    summary: "Get summary for benefits coverage (Network Admin)",
  })
  @ApiOkResponse({
    type: EmployeeBenefitSummaryDto,
    description: "Summary statistics of employee benefits coverage",
  })
  async getSummary(@TenantId() tenant_id: string) {
    return this.employeeBenefitsService.getSummary(tenant_id);
  }
}
