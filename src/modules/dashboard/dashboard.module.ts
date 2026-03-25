import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Employee } from '../../entities/employee.entity';
import { EmployeeSalary } from '../../entities/employee-salary.entity';
import { PayrollRecord } from '../../entities/payroll-record.entity';
import { Attendance } from '../../entities/attendance.entity';
import { Department } from '../../entities/department.entity';
import { Designation } from '../../entities/designation.entity';
import { Team } from '../../entities/team.entity';
import { User } from '../../entities/user.entity';
import { Leave } from '../../entities/leave.entity';
import { EmployeeModule } from '../employee/employee.module';
import { PayrollModule } from '../payroll/payroll.module';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeSalary,
      PayrollRecord,
      Attendance,
      Department,
      Designation,
      Team,
      User,
      Leave,
    ]),
    forwardRef(() => EmployeeModule),
    forwardRef(() => PayrollModule),
    SharedJwtModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

