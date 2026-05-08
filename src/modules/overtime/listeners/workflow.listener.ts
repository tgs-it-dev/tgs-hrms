import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OvertimeService } from '../overtime.service';
import { WorkflowCompletedEvent } from '../../workflow/events/workflow-completed.event';
import { WORKFLOW_EVENTS } from '../../workflow/constants/workflow.constants';
import { WorkflowRequestType } from '../../../common/constants/enums';

@Injectable()
export class OvertimeWorkflowListener {
  private readonly logger = new Logger(OvertimeWorkflowListener.name);

  constructor(private readonly overtimeService: OvertimeService) {}

  @OnEvent(WORKFLOW_EVENTS.REQUEST_APPROVED, { async: true })
  async handleApproved(event: WorkflowCompletedEvent): Promise<void> {
    if (event.requestType !== (WorkflowRequestType.OVERTIME as string)) return;
    try {
      await this.overtimeService.markApproved(
        event.relatedEntityId,
        event.tenantId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark overtime ${event.relatedEntityId} as approved`,
        error,
      );
    }
  }

  @OnEvent(WORKFLOW_EVENTS.REQUEST_REJECTED, { async: true })
  async handleRejected(event: WorkflowCompletedEvent): Promise<void> {
    if (event.requestType !== (WorkflowRequestType.OVERTIME as string)) return;
    try {
      await this.overtimeService.markRejected(
        event.relatedEntityId,
        event.tenantId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark overtime ${event.relatedEntityId} as rejected`,
        error,
      );
    }
  }

  @OnEvent(WORKFLOW_EVENTS.REQUEST_CANCELLED)
  handleCancelled(event: WorkflowCompletedEvent): void {
    if (event.requestType !== (WorkflowRequestType.OVERTIME as string)) return;
    this.logger.debug(
      `Overtime workflow ${event.workflowRequestId} cancelled event received`,
    );
  }
}
