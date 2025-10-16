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

@Module({
  imports: [
    TypeOrmModule.forFeature([Benefit, EmployeeBenefit, Employee, Tenant]),
    SharedJwtModule,
  ],
  providers: [
    BenefitsService,
    EmployeeBenefitsService,
    EmployeeBenefitsCronService,
  ],
  controllers: [BenefitsController, EmployeeBenefitsController],
  exports: [BenefitsService, EmployeeBenefitsService],
})
export class BenefitsModule {}
