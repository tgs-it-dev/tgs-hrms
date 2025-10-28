import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Asset } from "src/entities/asset.entity";
import { AssetStatus } from "src/common/constants/enums";
import { AssetSummary, AssetSummaryRow } from "../dto/system-asset/summary.dto";

@Injectable()
export class SystemAssetService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
  ) {}

  async getAllAssets(filters?: {
    category?: string;
    tenantId?: string;
    assigned?: "assigned" | "unassigned";
  }) {
    const qb = this.assetRepo
      .createQueryBuilder("asset")
      .leftJoinAndSelect("asset.tenant", "tenant")
      .leftJoinAndSelect("asset.assignedToUser", "user")
      .orderBy("asset.created_at", "DESC");

    if (filters?.category) {
      qb.andWhere("asset.category = :category", { category: filters.category });
    }

    if (filters?.tenantId) {
      qb.andWhere("asset.tenant_id = :tenantId", {
        tenantId: filters.tenantId,
      });
    }

    if (filters?.assigned === "assigned") {
      qb.andWhere("asset.assigned_to IS NOT NULL");
    } else if (filters?.assigned === "unassigned") {
      qb.andWhere("asset.assigned_to IS NULL");
    }

    return await qb.getMany();
  }

  async getAssetsSummary() {
    const qb = this.assetRepo
      .createQueryBuilder("asset")
      .leftJoin("asset.tenant", "tenant")
      .select("tenant.id", "tenantId")
      .addSelect("tenant.name", "tenantName")
      .addSelect("COUNT(asset.id)", "totalAssets")
      .addSelect(
        `SUM(CASE WHEN asset.status = :assigned THEN 1 ELSE 0 END)`,
        "assignedCount",
      )
      .addSelect(
        `SUM(CASE WHEN asset.status = :available THEN 1 ELSE 0 END)`,
        "availableCount",
      )
      .addSelect(
        `SUM(CASE WHEN asset.status = :maintenance THEN 1 ELSE 0 END)`,
        "maintenanceCount",
      )
      .addSelect(
        `SUM(CASE WHEN asset.status = :retired THEN 1 ELSE 0 END)`,
        "retiredCount",
      )
      .addSelect(
        `SUM(CASE WHEN asset.status = :lost THEN 1 ELSE 0 END)`,
        "lostCount",
      )
      .setParameters({
        assigned: AssetStatus.ASSIGNED,
        available: AssetStatus.AVAILABLE,
        maintenance: AssetStatus.UNDER_MAINTENANCE,
        retired: AssetStatus.RETIRED,
        lost: AssetStatus.LOST,
      })
      .groupBy("tenant.id")
      .addGroupBy("tenant.name")
      .orderBy("tenant.name", "ASC");

    const rows: AssetSummaryRow[] = await qb.getRawMany();

    return rows.map(
      (r): AssetSummary => ({
        tenantId: r.tenantId,
        tenantName: r.tenantName,
        totalAssets: Number(r.totalAssets),
        assignedCount: Number(r.assignedCount),
        availableCount: Number(r.availableCount),
        maintenanceCount: Number(r.maintenanceCount),
        retiredCount: Number(r.retiredCount),
        lostCount: Number(r.lostCount),
      }),
    );
  }
}
