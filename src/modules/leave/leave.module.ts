import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leave } from 'src/entities/leave.entity';
import { LeaveBalance } from '../../entities/leave-balance.entity';
import { LeaveType } from 'src/entities/leave-type.entity';
import { User } from '../../entities/user.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { LeaveBalancesController } from './leave-balances.controller';
import { Employee } from 'src/entities/employee.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { LeaveFileUploadService } from './services/leave-file-upload.service';
import { NotificationModule } from '../notification/notification.module';
import { Team } from '../../entities/team.entity';
import { TenantModule } from '../tenant/tenant.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { LeaveWorkflowListener } from './listeners/workflow.listener';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { EmailModule } from '../../common/utils/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Leave, LeaveBalance, LeaveType, User, Employee, Team]),
    SharedJwtModule,
    NotificationModule,
    TenantModule,
    WorkflowModule,
    TenantSettingsModule,
    EmailModule,
  ],
  providers: [LeaveService, LeaveFileUploadService, LeaveWorkflowListener],
  controllers: [LeaveController, LeaveBalancesController],
  exports: [LeaveService],
})
export class LeaveModule {}
