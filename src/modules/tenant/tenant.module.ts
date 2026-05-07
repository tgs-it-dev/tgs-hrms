import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TenantSchemaProvisioningService } from './services/tenant-schema-provisioning.service';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), SharedJwtModule],
  providers: [TenantService, TenantSchemaProvisioningService, TenantDatabaseService],
  controllers: [TenantController],
  exports: [TenantSchemaProvisioningService, TenantDatabaseService],
})
export class TenantModule {}
