import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowConfig } from '../../entities/workflow-config.entity';
import { WorkflowRequest } from '../../entities/workflow-request.entity';
import { WorkflowStep } from '../../entities/workflow-step.entity';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { TenantCreatedWorkflowListener } from './listeners/tenant-created.listener';
import { TenantModule } from '../tenant/tenant.module';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowConfig, WorkflowRequest, WorkflowStep]),
    SharedJwtModule,
    TenantModule,
  ],
  providers: [WorkflowService, TenantCreatedWorkflowListener],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}
