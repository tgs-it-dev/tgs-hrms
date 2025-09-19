import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { TimesheetModule } from '../timesheet/timesheet.module';
import { Employee } from 'src/entities/employee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance, Employee]), TimesheetModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
