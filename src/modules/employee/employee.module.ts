import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Designation } from '../../entities/designation.entity';
import { Team } from '../../entities/team.entity';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeService } from './services/employee.service';
import { Role } from 'src/entities/role.entity';
import { EmployeeProfileController } from './controllers/employee-profile.controller';
import { EmployeeProfileService } from './services/employee-profile.service';
import { Attendance } from 'src/entities/attendance.entity';
import { Leave } from 'src/entities/leave.entity';
import { AttendanceModule } from '../attendance/attendace.module';
import { LeaveModule } from '../leave/leave.module';
import { EmailModule } from '../../common/utils/email/email.module';
import { InviteStatusModule } from '../invite-status/invite-status.module';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { EmployeeCreationService } from './services/employee-creation.service';
import { EmployeeValidationService } from './services/employee-validation.service';
import { EmployeeNotificationService } from './services/employee-notification.service';
import { EmployeeFileService } from './services/employee-file.service';
import { BillingModule } from '../billing/billing.module';
import { PayrollModule } from '../payroll/payroll.module';
import { FileStorageService } from '../../common/services/file-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, User, Designation, Role, Team, Attendance, Leave]),
    AttendanceModule,
    LeaveModule,
    InviteStatusModule,
    EmailModule,
    SharedJwtModule,
    forwardRef(() => BillingModule),
    PayrollModule,
  ],
  controllers: [EmployeeController, EmployeeProfileController],
  providers: [
    EmployeeService,
    EmployeeProfileService,
    EmployeeCreationService,
    EmployeeValidationService,
    EmployeeNotificationService,
    EmployeeFileService,
    FileStorageService,
  ],
  exports: [EmployeeService],
})
export class EmployeeModule {}
