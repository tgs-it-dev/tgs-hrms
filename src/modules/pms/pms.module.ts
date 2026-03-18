import { Module } from "@nestjs/common";
import { KpiService } from "./kpi/kpi.service";
import { EmployeeKpiService } from "./employee-kpi/employee-kpi.service";
import { PerformanceReviewService } from "./performance-review/performance-review.service";
import { PromotionService } from "./promotion/promotion.service";
import { PromotionController } from "./promotion/promotion.controller";
import { PerformanceReviewController } from "./performance-review/performance-review.controller";
import { EmployeeKpiController } from "./employee-kpi/employee-kpi.controller";
import { KpiController } from "./kpi/kpi.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Kpi } from "src/entities/kpi.entity";
import { EmployeeKpi } from "src/entities/employee-kpi.entity";
import { PerformanceReview } from "src/entities/performance-review.entity";
import { Promotion } from "src/entities/promotion.entity";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";
import { User } from "src/entities/user.entity";
import { Team } from "src/entities/team.entity";
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Kpi,
      EmployeeKpi,
      PerformanceReview,
      Promotion,
      Tenant,
      Employee,
      User,
      Team,
    ]),
    SharedJwtModule,
  ],
  providers: [
    KpiService,
    EmployeeKpiService,
    PerformanceReviewService,
    PromotionService,
  ],
  controllers: [
    PromotionController,
    PerformanceReviewController,
    EmployeeKpiController,
    KpiController,
  ],
  exports: [
    KpiService,
    EmployeeKpiService,
    PerformanceReviewService,
    PromotionService,
  ],
})
export class PmsModule {}
