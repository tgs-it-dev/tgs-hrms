import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { SystemPerformanceService } from "./system-performance.service";

@ApiTags("System (Performance)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("system-admin")
@Controller("system/performance")
export class SystemPerformanceController {
  constructor(private readonly performanceService: SystemPerformanceService) {}

  /**
   * KPI Overview
   * GET /system/performance/kpis
   */
  @Get("kpis")
  @ApiOperation({
    summary: "View KPI categories and scoring trends across tenants",
  })
  @ApiResponse({
    status: 200,
    description: "Aggregated KPI trends by tenant and category.",
    schema: {
      example: [
        {
          tenantId: "tenant_1",
          tenantName: "Acme Inc",
          categories: [
            { category: "Quality", avgScore: 89.5, recordCount: 12 },
            { category: "Efficiency", avgScore: 92.1, recordCount: 10 },
          ],
        },
      ],
    },
  })
  async getKpiOverview() {
    return this.performanceService.getKpiOverview();
  }

  /**
   * Performance Records
   * GET /system/performance/records
   */
  @Get("records")
  @ApiOperation({
    summary: "Fetch summarized performance reviews per employee (Paginated)",
  })
  @ApiQuery({ name: "tenantId", required: false })
  @ApiQuery({ name: "cycle", required: false })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["under_review", "completed"],
  })
  @ApiQuery({ name: "minScore", required: false, type: Number })
  @ApiQuery({ name: "maxScore", required: false, type: Number })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiQuery({ name: "page", required: false, type: Number, description: "Page number (default: 1)" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 25, max: 100)" })
  @ApiResponse({
    status: 200,
    description: "List of performance reviews across tenants.",
  })
  async getPerformanceRecords(
    @Query("tenantId") tenantId?: string,
    @Query("cycle") cycle?: string,
    @Query("status") status?: "under_review" | "completed",
    @Query("minScore") minScore?: number,
    @Query("maxScore") maxScore?: number,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit || '25', 10) || 25));
    return this.performanceService.getPerformanceRecords({
      tenantId,
      cycle,
      status,
      minScore,
      maxScore,
      startDate,
      endDate,
      page: pageNumber,
      limit: limitNumber,
    });
  }

  /**
   * Promotions Overview
   * GET /system/performance/promotions
   */
  @Get("promotions")
  @ApiOperation({
    summary: "Track vertical promotions and pending evaluations (Paginated)",
  })
  @ApiQuery({ name: "tenantId", required: false })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["pending", "approved", "rejected"],
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
  @ApiQuery({ name: "page", required: false, type: Number, description: "Page number (default: 1)" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 25, max: 100)" })
  @ApiResponse({
    status: 200,
    description: "List of promotions and aggregate promotion statistics.",
    schema: {
      example: {
        promotions: [
          {
            id: "promo_123",
            employee: { id: "emp_1", name: "John Doe" },
            status: "approved",
            createdAt: "2025-08-01T12:00:00Z",
          },
        ],
        stats: [
          {
            tenantId: "tenant_1",
            approvedCount: 4,
            pendingCount: 2,
            rejectedCount: 1,
          },
        ],
      },
    },
  })
  async getPromotionsOverview(
    @Query("tenantId") tenantId?: string,
    @Query("status") status?: "pending" | "approved" | "rejected",
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit || '25', 10) || 25));
    return this.performanceService.getPromotionsOverview({
      tenantId,
      status,
      startDate,
      endDate,
      page: pageNumber,
      limit: limitNumber,
    });
  }
}
