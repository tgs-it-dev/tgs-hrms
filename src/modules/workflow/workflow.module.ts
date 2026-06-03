import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowConfig } from '../../entities/workflow-config.entity';
import { WorkflowRequest } from '../../entities/workflow-request.entity';
import { WorkflowStep } from '../../entities/workflow-step.entity';
import { FlexRequestAudit } from '../../entities/flex-request-audit.entity';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { TenantCreatedWorkflowListener } from './listeners/tenant-created.listener';
import { TenantModule } from '../tenant/tenant.module';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowConfig,
      WorkflowRequest,
      WorkflowStep,
      FlexRequestAudit,
    ]),
    SharedJwtModule,
    TenantModule,
    TenantSettingsModule,
  ],
  providers: [WorkflowService, TenantCreatedWorkflowListener],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}
