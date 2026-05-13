import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Wfh } from '../../entities/wfh.entity';
import { User } from '../../entities/user.entity';
import { WfhService } from './wfh.service';
import { WfhController } from './wfh.controller';
import { WfhWorkflowListener } from './listeners/workflow.listener';
import { WorkflowModule } from '../workflow/workflow.module';
import { TenantModule } from '../tenant/tenant.module';
import { NotificationModule } from '../notification/notification.module';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wfh, User]),
    SharedJwtModule,
    TenantModule,
    NotificationModule,
    WorkflowModule,
  ],
  providers: [WfhService, WfhWorkflowListener],
  controllers: [WfhController],
  exports: [WfhService],
})
export class WfhModule {}
