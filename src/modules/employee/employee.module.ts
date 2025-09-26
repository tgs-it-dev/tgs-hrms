import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Designation } from '../../entities/designation.entity';
import { Team } from '../../entities/team.entity';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { Role } from 'src/entities/role.entity';
import { EmployeeProfileController } from './employee-profile.controller';
import { EmployeeProfileService } from './employee-profile.service';
import { Attendance } from 'src/entities/attendance.entity';
import { Leave } from 'src/entities/leave.entity';
import { AttendanceModule } from '../attendance/attendace.module';
import { LeaveModule } from '../leave/leave.module';
import { SendGridService } from '../auth/sendgrid.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, User, Designation, Role, Team, Attendance, Leave]),
    AttendanceModule,
    LeaveModule,
  ],
  controllers: [EmployeeController, EmployeeProfileController],
  providers: [EmployeeService, EmployeeProfileService, SendGridService],
})
export class EmployeeModule {}
