import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { TimesheetModule } from '../timesheet/timesheet.module';
import { Employee } from 'src/entities/employee.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TeamModule } from '../team/team.module';
import { Geofence } from '../../entities/geofence.entity';
import { NotificationModule } from '../notification/notification.module';
import { Team } from '../../entities/team.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance, Employee, Geofence, Team, User]),
    TimesheetModule,
    SharedJwtModule,
    TeamModule,
    NotificationModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
