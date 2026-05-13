import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WfhService } from '../wfh.service';
import { WorkflowCompletedEvent } from '../../workflow/events/workflow-completed.event';
import { WORKFLOW_EVENTS } from '../../workflow/constants/workflow.constants';
import { WorkflowRequestType } from '../../../common/constants/enums';

@Injectable()
export class WfhWorkflowListener {
  private readonly logger = new Logger(WfhWorkflowListener.name);

  constructor(private readonly wfhService: WfhService) {}

  @OnEvent(WORKFLOW_EVENTS.REQUEST_APPROVED, { async: true })
  async handleApproved(event: WorkflowCompletedEvent): Promise<void> {
    if (event.requestType !== (WorkflowRequestType.WFH as string)) return;
    try {
      await this.wfhService.markApproved(
        event.relatedEntityId,
        event.tenantId,
        event.requestorId,
        event.finalApproverId,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to mark WFH ${event.relatedEntityId} as approved`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  @OnEvent(WORKFLOW_EVENTS.REQUEST_REJECTED, { async: true })
  async handleRejected(event: WorkflowCompletedEvent): Promise<void> {
    if (event.requestType !== (WorkflowRequestType.WFH as string)) return;
    try {
      await this.wfhService.markRejected(
        event.relatedEntityId,
        event.tenantId,
        event.requestorId,
        event.finalApproverId,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to mark WFH ${event.relatedEntityId} as rejected`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  @OnEvent(WORKFLOW_EVENTS.REQUEST_CANCELLED)
  handleCancelled(event: WorkflowCompletedEvent): void {
    if (event.requestType !== (WorkflowRequestType.WFH as string)) return;
    this.logger.debug(
      `WFH workflow ${event.workflowRequestId} cancelled event received`,
    );
  }
}
