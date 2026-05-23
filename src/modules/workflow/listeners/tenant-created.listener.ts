import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowService } from '../workflow.service';

@Injectable()
export class TenantCreatedWorkflowListener {
  private readonly logger = new Logger(TenantCreatedWorkflowListener.name);

  constructor(private readonly workflowService: WorkflowService) {}

  @OnEvent('tenant.created', { async: true })
  async handle(event: { tenantId: string }): Promise<void> {
    try {
      await this.workflowService.seedDefaultConfigsForTenant(event.tenantId);
    } catch (error) {
      this.logger.error(
        `Failed to seed workflow configs for tenant ${event.tenantId}`,
        error,
      );
    }
  }
}
