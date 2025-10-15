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
import { BenefitsService } from "./benefits.service";
import { CreateBenefitDto } from "./dto/benefit/create-benefit.dto";
import { UpdateBenefitDto } from "./dto/benefit/update-benefit.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantId } from "../../common/decorators/company.deorator";
import { JwtUserPayloadDto } from "../auth/dto/jwt-payload.dto";

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
  @ApiResponse({
    status: 200,
    description: "List of all benefits for this tenant.",
  })
  async findAll(@TenantId() tenant_id: string, @Query("page") page?: string) {
    const pageNumber = Math.max(1, parseInt(page || "1", 10) || 1);
    return this.benefitService.findAllByTenant(tenant_id, pageNumber);
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
