import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Designation } from '../../entities/designation.entity';
import { Department } from '../../entities/department.entity';
import { DesignationController } from './designation.controller';
import { DesignationService } from './designation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Designation, Department])],
  controllers: [DesignationController],
  providers: [DesignationService],
  exports: [DesignationService],
})
export class DesignationModule {}
