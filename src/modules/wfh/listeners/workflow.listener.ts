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
    if (event.requestType !== WorkflowRequestType.WFH) return;
    try {
      await this.wfhService.markApproved(event.relatedEntityId, event.tenantId, event.finalApproverId);
    } catch (error) {
      this.logger.error(`Failed to mark WFH ${event.relatedEntityId} as approved`, error);
    }
  }

  @OnEvent(WORKFLOW_EVENTS.REQUEST_REJECTED, { async: true })
  async handleRejected(event: WorkflowCompletedEvent): Promise<void> {
    if (event.requestType !== WorkflowRequestType.WFH) return;
    try {
      await this.wfhService.markRejected(event.relatedEntityId, event.tenantId, event.finalApproverId);
    } catch (error) {
      this.logger.error(`Failed to mark WFH ${event.relatedEntityId} as rejected`, error);
    }
  }

  @OnEvent(WORKFLOW_EVENTS.REQUEST_CANCELLED, { async: true })
  async handleCancelled(event: WorkflowCompletedEvent): Promise<void> {
    if (event.requestType !== WorkflowRequestType.WFH) return;
    // WFH cancellation is initiated from WfhService itself, so this is a no-op guard
    this.logger.debug(`WFH workflow ${event.workflowRequestId} cancelled event received`);
  }
}
