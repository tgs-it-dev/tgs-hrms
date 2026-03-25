import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Timesheet } from '../../entities/timesheet.entity';
import { Attendance } from '../../entities/attendance.entity';
import { User } from '../../entities/user.entity';
import { TimesheetService } from './timesheet.service';
import { TimesheetController } from './timesheet.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Timesheet, Attendance, User]), SharedJwtModule],
  controllers: [TimesheetController],
  providers: [TimesheetService],
  exports: [TimesheetService],
})
export class TimesheetModule {}
