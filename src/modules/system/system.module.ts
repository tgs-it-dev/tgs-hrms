import { Module } from "@nestjs/common";
import { SystemController } from "./system.controller";
import { SystemService } from "./system.service";
import { SystemTenantService } from "./system-tenant/system-tenant.service";
import { SystemTenantController } from "./system-tenant/system-tenant.controller";
import { SystemEmployeeController } from "./system-employee/system-employee.controller";
import { SystemAssetController } from "./system-asset/system-asset.controller";
import { SystemLeaveController } from "./system-leave/system-leave.controller";
import { SystemPerformanceController } from "./system-performance/system-performance.controller";
import { SystemPerformanceService } from "./system-performance/system-performance.service";
import { SystemLeaveService } from "./system-leave/system-leave.service";
import { SystemAssetService } from "./system-asset/system-asset.service";
import { SystemEmployeeService } from "./system-employee/system-employee.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";
import { Department } from "src/entities/department.entity";
import { Designation } from "src/entities/designation.entity";
import { SystemLog } from "src/entities/system-log.entity";
import { SharedJwtModule } from "src/common/modules/jwt.module";
import { Leave } from "src/entities/leave.entity";
import { Asset } from "src/entities/asset.entity";
import { EmployeeKpi } from "src/entities/employee-kpi.entity";
import { Promotion } from "src/entities/promotion.entity";
import { PerformanceReview } from "src/entities/performance-review.entity";
import { User } from "src/entities/user.entity";
import { Role } from "src/entities/role.entity";
import { EmailModule } from "src/common/utils/email/email.module";
import { CompanyDetails } from "src/entities/company-details.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Employee,
      Department,
      Designation,
      SystemLog,
      Leave,
      Asset,
      EmployeeKpi,
      Promotion,
      PerformanceReview,
      User,
      Role,
      CompanyDetails,
    ]),
    SharedJwtModule,
    EmailModule,
  ],
  providers: [
    SystemService,
    SystemTenantService,
    SystemPerformanceService,
    SystemLeaveService,
    SystemAssetService,
    SystemEmployeeService,
  ],
  controllers: [
    SystemController,
    SystemTenantController,
    SystemEmployeeController,
    SystemAssetController,
    SystemLeaveController,
    SystemPerformanceController,
  ],
  exports: [
    SystemService,
    SystemTenantService,
    SystemPerformanceService,
    SystemLeaveService,
    SystemAssetService,
    SystemEmployeeService,
  ],
})
export class SystemModule {}
