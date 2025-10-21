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
import { JwtUserPayloadDto } from "src/modules/auth/dto/jwt-payload.dto";
import { PromotionService } from "./promotion.service";
import { CreatePromotionDto } from "../dtos/promotion/create-promotion.dto";
import { ApprovePromotionDto } from "../dtos/promotion/approve-promotion.dto";

@ApiTags("Promotions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller("promotions")
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  /**
   * Create a new promotion request (Manager only)
   */
  @Post()
  @Roles("manager")
  @ApiOperation({ summary: "Create a new promotion request for an employee" })
  @ApiResponse({
    status: 201,
    description: "Promotion request created successfully.",
  })
  async create(@TenantId() tenantId: string, @Body() dto: CreatePromotionDto) {
    return this.promotionService.create(tenantId, dto);
  }

  /**
   * Get list of promotions (Employees see their own, Managers see all they created, HR-Admins see all)
   */
  @Get()
  @Roles("employee", "manager", "hr-admin")
  @ApiOperation({
    summary:
      "Get all promotions for a tenant (optionally filter by employeeId). Employees can only view their own records. Manager can view any promotions they created",
  })
  @ApiResponse({
    status: 200,
    description: "List of promotions for the tenant.",
  })
  @ApiQuery({ name: "employeeId", type: String, required: false })
  async findAll(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Query("employeeId") employeeId?: string,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;

    // Employee can only view their own promotions
    if (user.role === "employee") {
      if (employeeId && employeeId !== user.id) {
        throw new ForbiddenException(
          "You can only view your own promotion records.",
        );
      }

      const all = await this.promotionService.findAll(tenantId, user.id);
      return all.filter((p) => p.employee_id === user.id);
    }

    // Manager can view any promotions they created (by their employees)
    if (user.role === "manager") {
      return this.promotionService.findAll(tenantId, employeeId);
    }

    // HR Admin can view all
    return this.promotionService.findAll(tenantId, employeeId);
  }

  /**
   * Get a single promotion by ID
   */
  @Get(":id")
  @Roles("employee", "manager", "hr-admin")
  @ApiOperation({ summary: "Get a single promotion by ID" })
  @ApiResponse({
    status: 200,
    description: "Promotion record details.",
  })
  async findOne(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;
    const promotion = await this.promotionService.findOne(tenantId, id);

    // Employee can only view their own
    if (user.role === "employee" && promotion.employee_id !== user.id) {
      throw new ForbiddenException(
        "You can only view your own promotion record.",
      );
    }

    return promotion;
  }

  /**
   * Approve or reject a promotion (HR Admin only)
   */
  @Put(":id/approve")
  @Roles("hr-admin")
  @ApiOperation({ summary: "Approve or reject a promotion request" })
  @ApiResponse({
    status: 200,
    description: "Promotion request processed successfully.",
  })
  async approve(
    @TenantId() tenantId: string,
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: ApprovePromotionDto,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;
    return this.promotionService.approve(tenantId, id, user.id, dto);
  }
}
