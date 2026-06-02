import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../entities/user.entity';

import { WorkflowCompletedEvent } from '../workflow/events/workflow-completed.event';
import { WORKFLOW_EVENTS } from '../workflow/constants/workflow.constants';
import {
  WorkflowRequestType,
  LeaveStatus,
  WfhStatus,
  OvertimeStatus,
  WorkflowStepStatus,
} from '../../common/constants/enums';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

import {
  NotificationsEmailService,
  WorkflowEmailContext,
} from './notifications-email.service';

// Minimal shape for tenant-schema entities — no entity class needed
interface LeaveRow {
  id: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  leaveTypeName?: string;
}
interface WfhRow {
  id: string;
  tenant_id: string;
  start_date: Date;
  end_date: Date;
  reason: string;
}
interface OvertimeRow {
  id: string;
  tenant_id: string;
  start_date: Date;
  end_date: Date;
  hours: string;
  reason: string;
}
interface StepRow {
  id: string;
  approver_role: string;
  step_label: string;
  step_order: number;
}

@Injectable()
export class NotificationsEmailListener {
  private readonly logger = new Logger(NotificationsEmailListener.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly tenantDbService: TenantDatabaseService,
    private readonly notificationsEmailService: NotificationsEmailService,
  ) {}

  // ─── Intermediate step approved ───────────────────────────────────────────

  @OnEvent(WORKFLOW_EVENTS.STEP_APPROVED, { async: true })
  async handleStepApproved(event: WorkflowCompletedEvent): Promise<void> {
    try {
      const context = await this.resolveContext(event);
      if (!context) return;

      // Notify employee their request is moving to the next reviewer
      this.notificationsEmailService.sendStepApprovedToEmployee(
        event.requestorId,
        context,
      );

      // Find the next pending step in the tenant schema and notify every eligible approver
      const nextStep = await this.tenantDbService.withTenantSchema(
        event.tenantId,
        async (em) => {
          const rows = await em.query<StepRow[]>(
            `SELECT id, approver_role, step_label, step_order
               FROM workflow_steps
              WHERE workflow_request_id = $1
                AND status = $2
              ORDER BY step_order ASC
              LIMIT 1`,
            [event.workflowRequestId, WorkflowStepStatus.PENDING],
          );
          return rows[0] ?? null;
        },
      );

      if (nextStep) {
        const approvers = await this.getUsersByRole(
          nextStep.approver_role,
          event.tenantId,
        );
        for (const approver of approvers) {
          this.notificationsEmailService.sendPendingApprovalToApprover(
            approver.id,
            event.requestorId,
            context,
            nextStep.step_label,
          );
        }
      }
    } catch (err: unknown) {
      this.logger.error(
        `Email listener error on STEP_APPROVED for ${event.requestType} ${event.relatedEntityId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Request fully approved ───────────────────────────────────────────────

  @OnEvent(WORKFLOW_EVENTS.REQUEST_APPROVED, { async: true })
  async handleApproved(event: WorkflowCompletedEvent): Promise<void> {
    try {
      const context = await this.resolveContext(event);
      if (!context) return;

      if (context.requestType === WorkflowRequestType.LEAVE) {
        this.notificationsEmailService.sendLeaveStatusUpdate(
          event.requestorId,
          context,
          LeaveStatus.APPROVED,
        );
      } else if (context.requestType === WorkflowRequestType.WFH) {
        this.notificationsEmailService.sendFlexStatusUpdate(
          event.requestorId,
          context,
          WfhStatus.APPROVED,
        );
      } else if (context.requestType === WorkflowRequestType.OVERTIME) {
        this.notificationsEmailService.sendOvertimeStatusUpdate(
          event.requestorId,
          context,
          OvertimeStatus.APPROVED,
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `Email listener error on REQUEST_APPROVED for ${event.requestType} ${event.relatedEntityId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Request rejected ─────────────────────────────────────────────────────

  @OnEvent(WORKFLOW_EVENTS.REQUEST_REJECTED, { async: true })
  async handleRejected(event: WorkflowCompletedEvent): Promise<void> {
    try {
      const context = await this.resolveContext(event);
      if (!context) return;

      if (context.requestType === WorkflowRequestType.LEAVE) {
        this.notificationsEmailService.sendLeaveStatusUpdate(
          event.requestorId,
          context,
          LeaveStatus.REJECTED,
        );
      } else if (context.requestType === WorkflowRequestType.WFH) {
        this.notificationsEmailService.sendFlexStatusUpdate(
          event.requestorId,
          context,
          WfhStatus.REJECTED,
        );
      } else if (context.requestType === WorkflowRequestType.OVERTIME) {
        this.notificationsEmailService.sendOvertimeStatusUpdate(
          event.requestorId,
          context,
          OvertimeStatus.REJECTED,
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `Email listener error on REQUEST_REJECTED for ${event.requestType} ${event.relatedEntityId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async resolveContext(
    event: WorkflowCompletedEvent,
  ): Promise<WorkflowEmailContext | null> {
    return this.tenantDbService.withTenantSchema(event.tenantId, async (em) => {
      switch (event.requestType) {
        case WorkflowRequestType.LEAVE: {
          const rows = await em.query<LeaveRow[]>(
            `SELECT l.id, l."tenantId", l."startDate", l."endDate", l."totalDays", l.reason,
                    lt.name AS "leaveTypeName"
               FROM leaves l
               LEFT JOIN leave_types lt ON lt.id = l."leaveTypeId"
              WHERE l.id = $1
              LIMIT 1`,
            [event.relatedEntityId],
          );
          const row = rows[0];
          if (!row) return null;
          return {
            id: row.id,
            tenantId: row.tenantId,
            startDate: row.startDate,
            endDate: row.endDate,
            totalDays: row.totalDays,
            reason: row.reason,
            requestType:
              WorkflowRequestType.LEAVE as WorkflowEmailContext['requestType'],
            leaveTypeName: row.leaveTypeName,
          } satisfies WorkflowEmailContext;
        }

        case WorkflowRequestType.WFH: {
          const rows = await em.query<WfhRow[]>(
            `SELECT id, tenant_id, start_date, end_date, reason
               FROM wfh_requests WHERE id = $1 LIMIT 1`,
            [event.relatedEntityId],
          );
          const row = rows[0];
          if (!row) return null;
          return {
            id: row.id,
            tenantId: row.tenant_id,
            startDate: row.start_date,
            endDate: row.end_date,
            reason: row.reason,
            requestType:
              WorkflowRequestType.WFH as WorkflowEmailContext['requestType'],
          } satisfies WorkflowEmailContext;
        }

        case WorkflowRequestType.OVERTIME: {
          const rows = await em.query<OvertimeRow[]>(
            `SELECT id, tenant_id, start_date, end_date, hours, reason
               FROM overtime_requests WHERE id = $1 LIMIT 1`,
            [event.relatedEntityId],
          );
          const row = rows[0];
          if (!row) return null;
          return {
            id: row.id,
            tenantId: row.tenant_id,
            startDate: row.start_date,
            endDate: row.end_date,
            hours: Number(row.hours),
            reason: row.reason,
            requestType:
              WorkflowRequestType.OVERTIME as WorkflowEmailContext['requestType'],
          } satisfies WorkflowEmailContext;
        }

        default:
          this.logger.warn(
            `Unknown requestType=${event.requestType} — skipping email`,
          );
          return null;
      }
    });
  }

  /** Returns all users in the tenant whose role name matches approverRole (case-insensitive). */
  private async getUsersByRole(
    approverRole: string,
    tenantId: string,
  ): Promise<User[]> {
    return this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('LOWER(role.name) = :role', {
        role: approverRole.toLowerCase(),
      })
      .select([
        'user.id',
        'user.email',
        'user.first_name',
        'user.last_name',
        'user.tenant_id',
        'user.email_notifications_enabled',
      ])
      .getMany();
  }
}
