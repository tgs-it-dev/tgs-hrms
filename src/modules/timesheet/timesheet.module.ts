import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Timesheet } from '../../entities/timesheet.entity';
import { Attendance } from '../../entities/attendance.entity';
import { User } from '../../entities/user.entity';
import { CommonModule } from '../../common/common.module';
import { TimesheetService } from './timesheet.service';
import { TimesheetController } from './timesheet.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Timesheet, Attendance, User]), CommonModule],
  controllers: [TimesheetController],
  providers: [TimesheetService],
  exports: [TimesheetService],
})
export class TimesheetModule {}


