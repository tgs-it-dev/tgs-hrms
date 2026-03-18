import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollConfig } from '../../entities/payroll-config.entity';
import { EmployeeSalary } from '../../entities/employee-salary.entity';
import { PayrollRecord } from '../../entities/payroll-record.entity';
import { Employee } from '../../entities/employee.entity';
import { Tenant } from '../../entities/tenant.entity';
import { Attendance } from '../../entities/attendance.entity';
import { Leave } from '../../entities/leave.entity';
import { EmployeeKpi } from '../../entities/employee-kpi.entity';
import { User } from '../../entities/user.entity';
import { PayrollConfigService } from './services/payroll-config.service';
import { EmployeeSalaryService } from './services/employee-salary.service';
import { PayrollRecordService } from './services/payroll-record.service';
import { PayrollConfigController } from './controllers/payroll-config.controller';
import { EmployeeSalaryController } from './controllers/employee-salary.controller';
import { PayrollRecordController } from './controllers/payroll-record.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayrollConfig,
      EmployeeSalary,
      PayrollRecord,
      Employee,
      Tenant,
      Attendance,
      Leave,
      EmployeeKpi,
      User,
    ]),
    SharedJwtModule,
  ],
  controllers: [
    PayrollConfigController,
    EmployeeSalaryController,
    PayrollRecordController,
  ],
  providers: [
    PayrollConfigService,
    EmployeeSalaryService,
    PayrollRecordService,
  ],
  exports: [
    PayrollConfigService,
    EmployeeSalaryService,
    PayrollRecordService,
  ],
})
export class PayrollModule {}

