import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Designation } from 'src/entities/designation.entity';
// import { Designation } from 'src/entities/designation.entity';
// import { Department } from '../../entities/department.entity';
import { Department } from 'src/entities/department.entity';
import { DesignationService } from './designation.service';
import { DesignationController } from './designation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Designation, Department])],
  controllers: [DesignationController],
  providers: [DesignationService],
})
export class DesignationModule {}
