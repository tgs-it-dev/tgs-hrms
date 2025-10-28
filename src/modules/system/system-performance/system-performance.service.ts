import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EmployeeKpi } from "src/entities/employee-kpi.entity";
import { Promotion } from "src/entities/promotion.entity";
import { PerformanceReview } from "src/entities/performance-review.entity";
import {
  KpiCategoryStats,
  KpiOverviewRow,
  KpiTenantOverview,
} from "../dto/system-performance/kpi-overview.dto";
import {
  PerformanceStat,
  PerformanceStatRow,
} from "../dto/system-performance/performance-overview.dto";

@Injectable()
export class SystemPerformanceService {
  constructor(
    @InjectRepository(EmployeeKpi)
    private readonly employeeKpiRepo: Repository<EmployeeKpi>,

    @InjectRepository(PerformanceReview)
    private readonly reviewRepo: Repository<PerformanceReview>,

    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
  ) {}

  async getKpiOverview(): Promise<KpiTenantOverview[]> {
    const qb = this.employeeKpiRepo
      .createQueryBuilder("ekpi")
      .leftJoin("ekpi.kpi", "kpi")
      .leftJoin("ekpi.tenant", "tenant")
      .select("tenant.id", "tenantId")
      .addSelect("tenant.name", "tenantName")
      .addSelect("kpi.category", "category")
      .addSelect("AVG(ekpi.score)", "avgScore")
      .addSelect("COUNT(ekpi.id)", "recordCount")
      .groupBy("tenant.id")
      .addGroupBy("tenant.name")
      .addGroupBy("kpi.category")
      .orderBy("AVG(ekpi.score)", "DESC");

    const rows: KpiOverviewRow[] = await qb.getRawMany();

    const overview = rows.reduce(
      (acc, row) => {
        const tenant = acc[row.tenantId] || {
          tenantId: row.tenantId,
          tenantName: row.tenantName,
          categories: [] as KpiCategoryStats[],
        };

        tenant.categories.push({
          category: row.category,
          avgScore: Number(Number(row.avgScore).toFixed(2)),
          recordCount: Number(row.recordCount),
        });

        acc[row.tenantId] = tenant;
        return acc;
      },
      {} as Record<string, KpiTenantOverview>,
    );

    return Object.values(overview);
  }

  async getPerformanceRecords(filters?: {
    tenantId?: string;
    cycle?: string;
    status?: "under_review" | "completed";
    minScore?: number;
    maxScore?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const qb = this.reviewRepo
      .createQueryBuilder("review")
      .leftJoinAndSelect("review.employee", "employee")
      .leftJoinAndSelect("review.tenant", "tenant");

    if (filters?.tenantId)
      qb.andWhere("review.tenant_id = :tenantId", {
        tenantId: filters.tenantId,
      });

    if (filters?.cycle)
      qb.andWhere("review.cycle = :cycle", { cycle: filters.cycle });

    if (filters?.status)
      qb.andWhere("review.status = :status", { status: filters.status });

    if (filters?.minScore !== undefined && filters?.maxScore !== undefined) {
      qb.andWhere("review.overallScore BETWEEN :min AND :max", {
        min: filters.minScore,
        max: filters.maxScore,
      });
    }

    if (filters?.startDate && filters?.endDate) {
      qb.andWhere("review.createdAt BETWEEN :start AND :end", {
        start: filters.startDate,
        end: filters.endDate,
      });
    }

    qb.orderBy("review.createdAt", "DESC");

    return await qb.getMany();
  }

  async getPromotionsOverview(filters?: {
    tenantId?: string;
    status?: "pending" | "approved" | "rejected";
    startDate?: string;
    endDate?: string;
  }) {
    const qb = this.promotionRepo
      .createQueryBuilder("promotion")
      .leftJoinAndSelect("promotion.employee", "employee")
      .leftJoinAndSelect("promotion.tenant", "tenant");

    if (filters?.tenantId)
      qb.andWhere("promotion.tenant_id = :tenantId", {
        tenantId: filters.tenantId,
      });

    if (filters?.status)
      qb.andWhere("promotion.status = :status", { status: filters.status });

    if (filters?.startDate && filters?.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      end.setDate(end.getDate() + 1);

      qb.andWhere("promotion.createdAt BETWEEN :start AND :end", {
        start,
        end,
      });
    }

    qb.orderBy("promotion.createdAt", "DESC");

    const promotions = await qb.getMany();

    const statsQb = this.promotionRepo
      .createQueryBuilder("promotion")
      .select("promotion.tenant_id", "tenantId")
      .addSelect(
        `SUM(CASE WHEN promotion.status = 'approved' THEN 1 ELSE 0 END)`,
        "approvedCount",
      )
      .addSelect(
        `SUM(CASE WHEN promotion.status = 'pending' THEN 1 ELSE 0 END)`,
        "pendingCount",
      )
      .addSelect(
        `SUM(CASE WHEN promotion.status = 'rejected' THEN 1 ELSE 0 END)`,
        "rejectedCount",
      )
      .groupBy("promotion.tenant_id");

    if (filters?.startDate && filters?.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      end.setDate(end.getDate() + 1);

      statsQb.andWhere("promotion.createdAt BETWEEN :start AND :end", {
        start,
        end,
      });
    }

    const stats: PerformanceStatRow[] = await statsQb.getRawMany();

    return {
      promotions,
      stats: stats.map((s): PerformanceStat => {
        return {
          tenantId: s.tenantId,
          approvedCount: Number(s.approvedCount),
          pendingCount: Number(s.pendingCount),
          rejectedCount: Number(s.rejectedCount),
        };
      }),
    };
  }
}
