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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RolesGuard } from "src/common/guards/roles.guard";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { CreateEmployeeBenefitDto } from "../dto/employee-benefit/create-employee-benefit.dto";
import { TenantId } from "src/common/decorators/company.deorator";
import { JwtUserPayloadDto } from "src/modules/auth/dto/jwt-payload.dto";

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
  @ApiOperation({
    summary: "Get employee benefits (filtered by employee if needed)",
  })
  async findAll(@Req() req: any, @Query("employeeId") employeeId: string) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;

    if (!employeeId) {
      throw new BadRequestException("employeeId query param required");
    }

    if (user.role === "hr-admin") {
      // HR Admin: can view any employee’s benefits (optionally filter by employeeId)
      return await this.employeeBenefitsService.findAllByEmployee(
        user.tenant_id as string,
        employeeId,
      );
    }

    if (user.role === "employee") {
      // Employee can only view their own benefits
      if (employeeId && employeeId !== user.id) {
        throw new ForbiddenException(
          "You are not allowed to view other employees' benefits",
        );
      }

      // Always force their own ID
      return this.employeeBenefitsService.findAllByEmployee(
        user.tenant_id as string,
        user.id,
      );
    }

    throw new ForbiddenException("Access denied");
  }

  @Put(":id/cancel")
  @Roles("hr-admin")
  @ApiOperation({ summary: "Cancel an employee benefit" })
  async cancel(@TenantId() tenant_id: string, @Param("id") id: string) {
    return this.employeeBenefitsService.cancel(tenant_id, id);
  }
}
