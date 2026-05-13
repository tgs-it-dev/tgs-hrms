import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceAutoCheckoutCron } from './attendance-auto-checkout.cron';
import { TimesheetModule } from '../timesheet/timesheet.module';
import { Employee } from 'src/entities/employee.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TeamModule } from '../team/team.module';
import { Geofence } from '../../entities/geofence.entity';
import { NotificationModule } from '../notification/notification.module';
import { Team } from '../../entities/team.entity';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { Shift } from '../../entities/shift.entity';
import { TenantModule } from '../tenant/tenant.module';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance, Employee, Geofence, Team, User, Tenant, Shift]),
    TimesheetModule,
    SharedJwtModule,
    TeamModule,
    NotificationModule,
    TenantModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceAutoCheckoutCron, TenantDatabaseService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
