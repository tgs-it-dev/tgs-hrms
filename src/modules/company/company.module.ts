import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyDetails } from "../../entities/company-details.entity";
import { Tenant } from "../../entities/tenant.entity";
import { CompanyController } from "./company.controller";
import { CompanyService } from "./company.service";

@Module({
  imports: [TypeOrmModule.forFeature([CompanyDetails, Tenant])],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
