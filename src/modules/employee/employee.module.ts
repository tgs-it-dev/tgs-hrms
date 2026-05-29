import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Designation } from '../../entities/designation.entity';
import { Team } from '../../entities/team.entity';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeService } from './services/employee.service';
import { Role } from '../../entities/role.entity';
import { EmployeeProfileController } from './controllers/employee-profile.controller';
import { EmployeeProfileService } from './services/employee-profile.service';
import { Attendance } from '../../entities/attendance.entity';
import { Leave } from '../../entities/leave.entity';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveModule } from '../leave/leave.module';
import { SendGridService } from '../../common/utils/email';
import { InviteStatusModule } from '../invite-status/invite-status.module';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { EmployeeFileUploadService } from './services/employee-file-upload.service';
import { BillingModule } from '../billing/billing.module';
import { Tenant } from '../../entities/tenant.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      User,
      Designation,
      Role,
      Team,
      Attendance,
      Leave,
      Tenant,
    ]),
    AttendanceModule,
    LeaveModule,
    InviteStatusModule,
    SharedJwtModule,
    forwardRef(() => BillingModule),
    TenantModule,
  ],
  controllers: [EmployeeController, EmployeeProfileController],
  providers: [
    EmployeeService,
    EmployeeProfileService,
    SendGridService,
    EmployeeFileUploadService,
  ],
  exports: [EmployeeService],
})
export class EmployeeModule {}
