import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { SystemTenantService } from './system-tenant/system-tenant.service';
import { SystemTenantController } from './system-tenant/system-tenant.controller';
import { SystemEmployeeController } from './system-employee/system-employee.controller';
import { SystemLeaveController } from './system-leave/system-leave.controller';
import { SystemLeaveService } from './system-leave/system-leave.service';
import { SystemEmployeeService } from './system-employee/system-employee.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { Employee } from '../../entities/employee.entity';
import { Department } from '../../entities/department.entity';
import { Designation } from '../../entities/designation.entity';
import { SystemLog } from '../../entities/system-log.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { Leave } from '../../entities/leave.entity';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { EmailModule } from '../../common/utils/email/email.module';
import { CompanyDetails } from '../../entities/company-details.entity';
import { SignupSession } from '../../entities/signup-session.entity';
import { SystemSettingsModule } from './system-settings/system-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Employee,
      Department,
      Designation,
      SystemLog,
      Leave,
      User,
      Role,
      CompanyDetails,
      SignupSession,
    ]),
    SharedJwtModule,
    EmailModule,
    SystemSettingsModule,
  ],
  providers: [
    SystemService,
    SystemTenantService,
    SystemLeaveService,
    SystemEmployeeService,
  ],
  controllers: [
    SystemController,
    SystemTenantController,
    SystemEmployeeController,
    SystemLeaveController,
  ],
  exports: [
    SystemService,
    SystemTenantService,
    SystemLeaveService,
    SystemEmployeeService,
  ],
})
export class SystemModule {}
