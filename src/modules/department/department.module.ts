import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TenantModule } from '../tenant/tenant.module';

import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Department]), SharedJwtModule, TenantModule],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {}
