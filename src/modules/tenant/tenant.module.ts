import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantController } from './tenant.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
  ],
  providers: [],
  controllers: [TenantController],
})
export class TenantModule {} 