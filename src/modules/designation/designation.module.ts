import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Designation } from '../../entities/designation.entity';
import { DesignationService } from './designation.service';
import { DesignationController } from './designation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Designation])],
  controllers: [DesignationController], 
  providers: [DesignationService],
  exports: [DesignationService],
})
export class DesignationModule {}
