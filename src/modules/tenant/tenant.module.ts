import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    CommonModule,
  ],
  providers: [TenantService],
  controllers: [TenantController],
})
export class TenantModule {} 