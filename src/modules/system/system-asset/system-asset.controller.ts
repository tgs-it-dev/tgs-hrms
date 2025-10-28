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
import { SystemAssetService } from "./system-asset.service";

@ApiTags("System (Assets)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("system/assets")
export class SystemAssetController {
  constructor(private readonly assetService: SystemAssetService) {}

  /**
   * Get all assets across tenants
   * GET /system/assets
   */
  @Get()
  @Roles("system-admin")
  @ApiOperation({
    summary:
      "List all assets across tenants with optional filters (category, tenant, assignment status).",
  })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "tenantId", required: false })
  @ApiQuery({
    name: "assigned",
    required: false,
    enum: ["assigned", "unassigned"],
  })
  @ApiResponse({
    status: 200,
    description: "List of assets with tenant and user details.",
    schema: {
      example: [
        {
          id: "asset_123",
          name: "Dell Laptop",
          category: "Electronics",
          status: "assigned",
          tenant: { id: "tenant_1", name: "Acme Inc" },
          assignedToUser: { id: "user_1", name: "John Doe" },
          purchase_date: "2025-04-01",
          created_at: "2025-05-10T12:00:00Z",
        },
      ],
    },
  })
  async getAllAssets(
    @Query("category") category?: string,
    @Query("tenantId") tenantId?: string,
    @Query("assigned") assigned?: "assigned" | "unassigned",
  ) {
    return this.assetService.getAllAssets({
      category,
      tenantId,
      assigned,
    });
  }

  /**
   * Assets Summary
   * GET /system/assets/summary
   */
  @Get("summary")
  @Roles("system-admin")
  @ApiOperation({
    summary:
      "View total assets, assigned vs available stats aggregated by tenant.",
  })
  @ApiResponse({
    status: 200,
    description: "Summary of asset statistics per tenant.",
    schema: {
      example: [
        {
          tenantId: "tenant_1",
          tenantName: "Acme Inc",
          totalAssets: 120,
          assignedCount: 80,
          availableCount: 40,
        },
      ],
    },
  })
  async getAssetsSummary() {
    return this.assetService.getAssetsSummary();
  }
}
