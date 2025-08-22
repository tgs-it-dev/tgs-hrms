import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CommonModule } from '../../common/common.module';

import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Department]), CommonModule],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {}
