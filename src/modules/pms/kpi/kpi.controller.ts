import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { KpiService } from "./kpi.service";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { TenantGuard } from "src/common/guards/tenant.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { TenantId } from "src/common/decorators/company.deorator";
import { CreateKpiDto } from "../dtos/kpi/create-kpi.dto";
import { JwtUserPayloadDto } from "src/modules/auth/dto/jwt-payload.dto";
import { UpdateKpiDto } from "../dtos/kpi/update-kpi.dto";

@ApiTags("KPIs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller("kpis")
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  @Post()
  @Roles("hr-admin", "system-admin")
  @ApiOperation({ summary: "Create a new KPI" })
  @ApiResponse({ status: 201, description: "KPI created successfully." })
  @ApiResponse({
    status: 409,
    description: "Conflict: KPI with this title already exists.",
    schema: {
      example: {
        statusCode: 409,
        message:
          "KPI with title 'Customer Satisfaction Score' already exists for this tenant.",
        error: "Conflict",
      },
    },
  })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateKpiDto,
    @Req() req: any,
  ) {
    const createdBy: string = (req as { user: JwtUserPayloadDto }).user.id;
    return this.kpiService.create(tenantId, createdBy, dto);
  }

  @Put(":id")
  @Roles("hr-admin", "system-admin")
  @ApiOperation({ summary: "Update an existing KPI" })
  @ApiResponse({ status: 200, description: "KPI updated successfully." })
  @ApiResponse({ status: 404, description: "KPI not found." })
  @ApiResponse({
    status: 409,
    description: "Conflict: KPI with this title already exists.",
    schema: {
      example: {
        statusCode: 409,
        message:
          "KPI with title 'Customer Satisfaction Score' already exists for this tenant.",
        error: "Conflict",
      },
    },
  })
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateKpiDto,
  ) {
    return this.kpiService.update(tenantId, id, dto);
  }

  @Get()
  @ApiOperation({
    summary: "List all KPIs for a tenant (accessible to all roles)",
  })
  @ApiResponse({
    status: 200,
    description: "List of all KPIs for this tenant.",
  })
  async findAll(@TenantId() tenantId: string, @Query("page") page?: string) {
    const pageNumber = Math.max(1, parseInt(page || "1", 10) || 1);
    return this.kpiService.findAllByTenant(tenantId, pageNumber);
  }

  @Delete(":id")
  @Roles("hr-admin", "system-admin")
  @ApiOperation({ summary: "Delete a KPI" })
  @ApiResponse({ status: 200, description: "KPI deleted successfully." })
  @ApiResponse({ status: 404, description: "KPI not found." })
  async remove(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.kpiService.remove(tenantId, id);
  }
}
