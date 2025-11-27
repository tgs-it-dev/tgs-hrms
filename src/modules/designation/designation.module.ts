import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Designation } from '../../entities/designation.entity';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { DesignationController } from './designation.controller';
import { DesignationService } from './designation.service';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Designation, Department, Tenant]), SharedJwtModule],
  controllers: [DesignationController],
  providers: [DesignationService],
  exports: [DesignationService],
})
export class DesignationModule {}
