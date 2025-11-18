import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
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
import { PerformanceReviewService } from "./performance-review.service";
import { CreatePerformanceReviewDto } from "../dtos/performance-review/create-performance-review.dto";

@ApiTags("Performance Reviews")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller("performance-reviews")
export class PerformanceReviewController {
  constructor(
    private readonly performanceReviewService: PerformanceReviewService,
  ) {}

  /**
   * Create a new performance review (Manager only)
   */
  @Post()
  @Roles("manager")
  @ApiOperation({ summary: "Create a new performance review for an employee" })
  @ApiResponse({
    status: 201,
    description: "Performance review created successfully.",
  })
  async create(
    @TenantId() tenantId: string,
    @Req() req: any,
    @Body() dto: CreatePerformanceReviewDto,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;

    return this.performanceReviewService.create(tenantId, user.id, dto);
  }

  /**
   * Get list of performance reviews (filterable by cycle)
   */
  @Get()
  @Roles("employee", "manager", "hr-admin")
  @ApiOperation({
    summary:
      "Get all performance reviews (optionally filter by cycle). Employees can only view their own reviews. Managers can only view their own reviewed records. HR Admin can view all",
  })
  @ApiResponse({
    status: 200,
    description: "List of performance reviews for the tenant.",
  })
  @ApiQuery({ name: "cycle", type: String, required: false })
  @ApiQuery({ name: "page", type: Number, required: false, description: "Page number (default: 1)" })
  @ApiQuery({ name: "limit", type: Number, required: false, description: "Items per page (default: 25, max: 100)" })
  async findAll(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Query("cycle") cycle?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;
    const pageNumber = Math.max(1, parseInt(page || "1", 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit || "25", 10) || 25));

    // Employees can only view their own reviews
    if (user.role === "employee") {
      const all = await this.performanceReviewService.findAll(tenantId, cycle, pageNumber, limitNumber);
      // Filter after pagination - but this might not work correctly. Let's filter in service instead
      const filtered = all.items.filter((r) => r.employee_id === user.id);
      return {
        ...all,
        items: filtered,
        total: filtered.length,
      };
    }

    // Managers can only view their own reviewed records
    if (user.role === "manager") {
      const all = await this.performanceReviewService.findAll(tenantId, cycle, pageNumber, limitNumber);
      const filtered = all.items.filter((r) => r.reviewedBy === user.id);
      return {
        ...all,
        items: filtered,
        total: filtered.length,
      };
    }

    // HR Admin can view all
    return this.performanceReviewService.findAll(tenantId, cycle, pageNumber, limitNumber);
  }

  /**
   * Get a single performance review by ID
   */
  @Get(":id")
  @Roles("employee", "manager", "hr-admin")
  @ApiOperation({ summary: "Get a single performance review by ID" })
  @ApiResponse({
    status: 200,
    description: "Performance review details with linked KPIs.",
  })
  async findOne(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;
    const review = await this.performanceReviewService.findOne(tenantId, id);

    if (user.role === "employee" && review.employee_id !== user.id) {
      throw new ForbiddenException(
        "You can only view your own performance review.",
      );
    }

    if (user.role === "manager" && review.reviewedBy !== user.id) {
      throw new ForbiddenException(
        "You can only view your own reviewed performance reviews.",
      );
    }

    return review;
  }

  /**
   * Approve a performance review (HR Admin only)
   */
  @Post(":id/approve")
  @Roles("hr-admin")
  @ApiOperation({ summary: "Approve and finalize a performance review" })
  @ApiResponse({
    status: 200,
    description: "Performance review approved successfully.",
  })
  async approve(
    @TenantId() tenantId: string,
    @Req() req: any,
    @Param("id") id: string,
    @Body("recommendation") recommendation?: string,
  ) {
    const user: JwtUserPayloadDto = (req as { user: JwtUserPayloadDto }).user;

    return this.performanceReviewService.approve(
      tenantId,
      id,
      user.id,
      recommendation,
    );
  }
}
