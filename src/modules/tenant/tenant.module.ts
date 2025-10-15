import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
  ],
  providers: [TenantService],
  controllers: [TenantController],
})
export class TenantModule {} 