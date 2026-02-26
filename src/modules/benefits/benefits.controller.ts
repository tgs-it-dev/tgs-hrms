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
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { BenefitsService } from "./benefits.service";
import { CreateBenefitDto } from "./dto/benefit/create-benefit.dto";
import { UpdateBenefitDto } from "./dto/benefit/update-benefit.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantId } from "../../common/decorators/company.deorator";
import { JwtUserPayloadDto } from "../auth/dto/jwt-payload.dto";
import { sendCsvResponse } from "../../common/utils/csv.util";

@ApiTags("Benefits")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller("benefits")
export class BenefitsController {
  constructor(private readonly benefitService: BenefitsService) {}

  @Post()
  @Roles("hr-admin", "system-admin")
  @ApiOperation({ summary: "Create a new benefit" })
  @ApiResponse({ status: 201, description: "Benefit created successfully." })
  @ApiResponse({
    status: 409,
    description: "Conflict: Benefit with this name already exists.",
    schema: {
      example: {
        statusCode: 409,
        message:
          "Benefit with name 'Health Insurance' already exists for this tenant.",
        error: "Conflict",
      },
    },
  })
  create(
    @TenantId() tenant_id: string,
    @Body() dto: CreateBenefitDto,
    @Req() req: any,
  ) {
    const createdBy: string = (req as { user: JwtUserPayloadDto }).user.id;

    return this.benefitService.create(tenant_id, createdBy, dto);
  }

  @Put(":id")
  @Roles("hr-admin", "system-admin")
  @ApiOperation({ summary: "Update an existing benefit" })
  @ApiResponse({ status: 200, description: "Benefit updated successfully." })
  @ApiResponse({ status: 404, description: "Benefit not found." })
  @ApiResponse({
    status: 409,
    description: "Conflict: Benefit with this name already exists.",
    schema: {
      example: {
        statusCode: 409,
        message:
          "Benefit with name 'Health Insurance' already exists for this tenant.",
        error: "Conflict",
      },
    },
  })
  async update(
    @TenantId() tenant_id: string,
    @Param("id") id: string,
    @Body() dto: UpdateBenefitDto,
  ) {
    return this.benefitService.update(tenant_id, id, dto);
  }

  @Get()
  @ApiOperation({
    summary: "List all benefits for a tenant (accessible to all roles)",
  })
  @ApiQuery({ name: "page", required: false, description: "Page number (default: 1)", type: String })
  @ApiQuery({ name: "type", required: false, description: "Filter by benefit type", type: String })
  @ApiQuery({ name: "status", required: false, description: "Filter by status: active | inactive", enum: ["active", "inactive"] })
  @ApiResponse({
    status: 200,
    description: "List of all benefits for this tenant.",
  })
  async findAll(
    @TenantId() tenant_id: string,
    @Query("page") page?: string,
    @Query("type") type?: string,
    @Query("status") status?: "active" | "inactive",
  ) {
    const pageNumber = Math.max(1, parseInt(page || "1", 10) || 1);
    return this.benefitService.findAllByTenant(tenant_id, pageNumber, type, status);
  }

  @Get("export")
  @Roles("hr-admin", "admin", "system-admin", "network-admin")
  @ApiOperation({
    summary: "Export benefits as CSV (Admin only)",
    description: "Download all benefits for the tenant as CSV. Same filters as GET /benefits (type, status) apply.",
  })
  @ApiQuery({ name: "type", required: false, description: "Filter by benefit type", type: String })
  @ApiQuery({ name: "status", required: false, description: "Filter by status: active | inactive", enum: ["active", "inactive"] })
  @ApiResponse({ status: 200, description: "CSV file of benefits." })
  async exportAll(
    @TenantId() tenant_id: string,
    @Res() res: Response,
    @Query("type") type?: string,
    @Query("status") status?: "active" | "inactive",
  ) {
    const items = await this.benefitService.findAllForExport(tenant_id, type, status);
    const rows = (items || []).map((b) => ({
      name: b.name,
      type: b.type,
      status: b.status,
      description: b.description || "",
      eligibility_criteria: b.eligibilityCriteria || "",
      created_at: b.createdAt,
    }));
    return sendCsvResponse(res, "benefits.csv", rows);
  }

  @Get(":id")
  @Roles("hr-admin", "system-admin")
  @ApiOperation({ summary: "Get a single benefit by ID" })
  @ApiResponse({ status: 200, description: "Benefit found." })
  @ApiResponse({ status: 404, description: "Benefit not found." })
  async findOne(@TenantId() tenant_id: string, @Param("id") id: string) {
    return this.benefitService.findOne(tenant_id, id);
  }

  @Delete(":id")
  @Roles("hr-admin", "system-admin")
  @ApiOperation({ summary: "Delete a benefit" })
  @ApiResponse({ status: 200, description: "Benefit deleted successfully." })
  @ApiResponse({ status: 404, description: "Benefit not found." })
  async remove(@TenantId() tenant_id: string, @Param("id") id: string) {
    return this.benefitService.remove(tenant_id, id);
  }
}
