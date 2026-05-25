import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyDetails, Tenant]),
    SharedJwtModule,
    TenantSettingsModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
