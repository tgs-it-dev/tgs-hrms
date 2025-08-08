import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Designation } from '../../entities/designation.entity';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { Role } from 'src/entities/role.entity';
import { EmployeeProfileController } from './employee-profile.controller';
import { EmployeeProfileService } from './employee-profile.service';
import { Attendance } from 'src/entities/attendance.entity';
import { Leave } from 'src/entities/leave.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, User, Designation,Role , Attendance , Leave]),
    
  ],
  controllers: [EmployeeController, EmployeeProfileController],
  providers: [EmployeeService,EmployeeProfileService],
})
export class EmployeeModule {}
