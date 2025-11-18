import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
// import { CreateTenantDto } from "../dto/system-tenant/create-tenant.dto";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { SystemTenantService } from "./system-tenant.service";
import { CreateTenantDto } from "../dto/system-tenant/create-tenant.dto";
import { UpdateTenantDto } from "../dto/system-tenant/update-tenant.dto";

@ApiTags("System (Tenants)")
@ApiBearerAuth()
@Roles("system-admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("system/tenants")
export class SystemTenantController {
  constructor(private readonly tenantService: SystemTenantService) {}

  /**
   * Create a new tenant
   */
  @Post()
  @ApiOperation({ summary: "Create a new tenant (System Admin only)" })
  @ApiResponse({ status: 201, description: "Tenant created successfully." })
  @ApiResponse({
    status: 409,
    description: "Conflict: Tenant with this name already exists.",
  })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  /**
   * Update tenant company details (name, logo, domain)
   */
  @Put()
  @ApiOperation({ summary: "Update tenant company details (System Admin only)" })
  @ApiBody({ type: UpdateTenantDto })
  @ApiResponse({
    status: 200,
    description: "Tenant company details updated successfully.",
  })
  @ApiResponse({
    status: 404,
    description: "Tenant not found.",
  })
  @ApiResponse({
    status: 409,
    description: "Conflict: Tenant name or domain already exists.",
  })
  async update(@Body() dto: UpdateTenantDto) {
    return this.tenantService.update(dto);
  }

  /**
   * Get all tenants with pagination
   */
  @Get()
  @ApiOperation({ summary: "List all tenants (System Admin only) - Paginated" })
  @ApiResponse({ status: 200, description: "List of tenants." })
  @ApiQuery({ name: "page", required: false, type: Number, description: "Page number (default: 1)" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 25, max: 100)" })
  @ApiQuery({ name: "includeDeleted", required: false, type: Boolean, description: "Include deleted tenants (default: true)" })
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("includeDeleted") includeDeleted?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit || '25', 10) || 25));
    const includeDeletedFlag = includeDeleted !== undefined ? includeDeleted === 'true' : true;
    return this.tenantService.findAll(pageNumber, limitNumber, includeDeletedFlag);
  }

  /**
   * Get single tenant by ID
   */
  @Get(":id")
  @ApiOperation({ summary: "Get tenant details by ID (System Admin only)" })
  @ApiResponse({ status: 200, description: "Tenant details." })
  @ApiResponse({ status: 404, description: "Tenant not found." })
  async getTenantDetails(@Param("id") id: string) {
    return this.tenantService.getTenantDetails(id);
  }

  /**
   * Update tenant status
   */
  @Put(":id/status")
  @ApiOperation({ summary: "Update tenant status (active/suspended)" })
  @ApiResponse({
    status: 200,
    description: "Tenant status updated successfully.",
  })
  @ApiResponse({ status: 404, description: "Tenant not found." })
  async updateStatus(
    @Param("id") id: string,
    @Query("status") status: "active" | "suspended",
  ) {
    if (!status) {
      throw new BadRequestException("Status query param required");
    }

    return this.tenantService.updateStatus(id, status);
  }

  /**
   * Soft delete tenant
   */
  @Delete(":id")
  @ApiOperation({ summary: "Soft delete a tenant (System Admin only)" })
  @ApiResponse({ status: 200, description: "Tenant deleted successfully." })
  @ApiResponse({ status: 404, description: "Tenant not found." })
  async remove(@Param("id") id: string) {
    return this.tenantService.remove(id);
  }

  /**
   * Restore deleted tenant
   */
  @Put(":id/restore")
  @ApiOperation({ summary: "Restore a deleted tenant (System Admin only)" })
  @ApiResponse({ status: 200, description: "Tenant restored successfully." })
  @ApiResponse({ status: 404, description: "Tenant not found or not deleted." })
  async restore(@Param("id") id: string) {
    return await this.tenantService.restore(id);
  }
}
