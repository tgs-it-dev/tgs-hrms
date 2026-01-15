import { Module } from "@nestjs/common";
import { BenefitsService } from "./benefits.service";
import { BenefitsController } from "./benefits.controller";
import { EmployeeBenefitsService } from "./employee-benefits/employee-benefits.service";
import { EmployeeBenefitsController } from "./employee-benefits/employee-benefits.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Benefit } from "src/entities/benefit.entity";
import { EmployeeBenefit } from "src/entities/employee-benefit.entity";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";
import { EmployeeBenefitsCronService } from "./employee-benefits/employee-benefits-cron.service";
import { SharedJwtModule } from "../../common/modules/jwt.module";
import { BenefitReimbursementRequest } from "../../entities/benefit-reimbursement-request.entity";
import { ReimbursementService } from "./reimbursement/reimbursement.service";
import { ReimbursementController } from "./reimbursement/reimbursement.controller";
import { ReimbursementFileUploadService } from "./reimbursement/reimbursement-file-upload.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Benefit,
      EmployeeBenefit,
      Employee,
      Tenant,
      BenefitReimbursementRequest,
    ]),
    SharedJwtModule,
  ],
  providers: [
    BenefitsService,
    EmployeeBenefitsService,
    EmployeeBenefitsCronService,
    ReimbursementService,
    ReimbursementFileUploadService,
  ],
  controllers: [
    BenefitsController,
    EmployeeBenefitsController,
    ReimbursementController,
  ],
  exports: [
    BenefitsService,
    EmployeeBenefitsService,
    ReimbursementService,
  ],
})
export class BenefitsModule {}
