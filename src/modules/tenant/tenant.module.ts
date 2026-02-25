import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from '../../entities/tenant.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), SharedJwtModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
