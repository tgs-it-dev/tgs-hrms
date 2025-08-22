import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HolidayController } from './holiday.controller';
import { HolidayService } from './holiday.service';
import { Holiday } from '../../entities/holiday.entity';
import { Tenant } from '../../entities/tenant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Holiday, Tenant])],
  controllers: [HolidayController],
  providers: [HolidayService],
  exports: [HolidayService],
})
export class HolidayModule {}
