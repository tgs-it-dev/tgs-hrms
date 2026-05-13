import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Overtime } from '../../entities/overtime.entity';
import { User } from '../../entities/user.entity';
import { OvertimeService } from './overtime.service';
import { OvertimeController } from './overtime.controller';
import { OvertimeWorkflowListener } from './listeners/workflow.listener';
import { WorkflowModule } from '../workflow/workflow.module';
import { TenantModule } from '../tenant/tenant.module';
import { NotificationModule } from '../notification/notification.module';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Overtime, User]),
    SharedJwtModule,
    TenantModule,
    NotificationModule,
    WorkflowModule,
  ],
  providers: [OvertimeService, OvertimeWorkflowListener],
  controllers: [OvertimeController],
  exports: [OvertimeService],
})
export class OvertimeModule {}
