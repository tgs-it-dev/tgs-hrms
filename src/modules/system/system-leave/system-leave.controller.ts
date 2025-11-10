import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { SystemLeaveService } from "./system-leave.service";
import { LeaveStatus } from "src/common/constants/enums";

@ApiTags("System (Leaves)")
@Controller("system/leaves")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("system-admin")
export class SystemLeaveController {
  constructor(private readonly systemLeaveService: SystemLeaveService) {}

  @Get()
  @ApiOperation({
    summary:
      "Get paginated list of leave records across all tenants (System Admin)",
  })
  @ApiQuery({ name: "tenantId", required: false })
  @ApiQuery({ name: "status", required: false, enum: LeaveStatus })
  @ApiQuery({
    name: "startDate",
    required: false,
    description: "format: yyyy-mm--dd",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    description: "format: yyyy-mm--dd",
  })
  async findAll(
    @Query("tenantId") tenantId?: string,
    @Query("status") status?: LeaveStatus,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const data = await this.systemLeaveService.findAll({
      tenantId,
      status,
      startDate,
      endDate,
    });

    return data;
  }

  @Get("summary")
  @ApiOperation({
    summary: "Get summary of leave statistics grouped by tenant (System Admin)",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    description: "format: yyyy-mm--dd",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    description: "format: yyyy-mm--dd",
  })
  async getSummary(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const data = await this.systemLeaveService.getSummary({
      startDate,
      endDate,
    });

    return data;
  }
}
