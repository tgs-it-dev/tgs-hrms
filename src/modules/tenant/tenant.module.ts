import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { SharedJwtModule } from '../../common/modules/jwt.module';
@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), SharedJwtModule],
  providers: [TenantService],
  controllers: [TenantController],
})
export class TenantModule {}
