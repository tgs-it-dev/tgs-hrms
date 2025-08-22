import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Designation } from '../../entities/designation.entity';
import { Department } from '../../entities/department.entity';
import { CommonModule } from '../../common/common.module';
import { DesignationController } from './designation.controller';
import { DesignationService } from './designation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Designation, Department]), CommonModule],
  controllers: [DesignationController],
  providers: [DesignationService],
  exports: [DesignationService],
})
export class DesignationModule {}
