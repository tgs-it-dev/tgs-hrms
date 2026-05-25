import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';

import { Leave } from '../../../entities/leave.entity';
import { LeaveBalance } from '../../../entities/leave-balance.entity';
import { LeaveType } from '../../../entities/leave-type.entity';
import { User } from '../../../entities/user.entity';
import {
  LeaveStatus,
  WorkflowRequestType,
} from '../../../common/constants/enums';
import { TenantDatabaseService } from '../../../common/services/tenant-database.service';
import { NotificationService } from '../../notification/notification.service';
import { NotificationGateway } from '../../notification/notification.gateway';
import { WorkflowCompletedEvent } from '../../workflow/events/workflow-completed.event';
import { WORKFLOW_EVENTS } from '../../workflow/constants/workflow.constants';
import { LeaveService } from '../../leave/leave.service';

@Injectable()
export class LeaveWorkflowListener {
  private readonly logger = new Logger(LeaveWorkflowListener.name);

  constructor(
    private readonly leaveService: LeaveService,
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
    private readonly tenantDbService: TenantDatabaseService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── Tenant context helper ─────────────────────────────────────────────────

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<
      { schema_provisioned: boolean }[]
    >(`SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`, [
      tenantId,
    ]);
    return result[0]?.schema_provisioned ?? false;
  }

  private async runInTenantContext<T>(
    tenantId: string,
    work: (
      leaveRepo: Repository<Leave>,
      balanceRepo: Repository<LeaveBalance>,
      leaveTypeRepo: Repository<LeaveType>,
      em: EntityManager | null,
    ) => Promise<T>,
  ): Promise<T> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        work(
          em.getRepository(Leave),
          em.getRepository(LeaveBalance),
          em.getRepository(LeaveType),
          em,
        ),
      );
    }
    return work(this.leaveRepo, this.leaveBalanceRepo, this.leaveTypeRepo, null);
  }

  private async getAdminUserIds(tenantId: string): Promise<string[]> {
    const users = await this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('LOWER(role.name) IN (:...names)', {
        names: ['admin', 'hr-admin', 'system-admin'],
      })
      .select(['user.id'])
      .getMany();
    return users.map((u) => u.id);
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  /**
   * A step was approved but more steps remain — map to PROCESSING status.
   */
  @OnEvent(WORKFLOW_EVENTS.STEP_APPROVED, { async: true })
  async handleStepApproved(event: WorkflowCompletedEvent): Promise<void> {
    if (event.requestType !== (WorkflowRequestType.LEAVE as string)) return;
    if (event.finalApproverId === event.requestorId) {
      this.logger.warn(`User ${event.finalApproverId} attempted to approve their own leave ${event.relatedEntityId} — skipping`);
      return;
    }
    try {
      await this.runInTenantContext(event.tenantId, async (leaveRepo, _balanceRepo, _leaveTypeRepo, _em) => {
        const leave = await leaveRepo.findOne({
          where: { id: event.relatedEntityId },
        });
        if (!leave) return;

        leave.status = LeaveStatus.PROCESSING;
        leave.approvedBy = event.finalApproverId!;
        leave.approvedAt = new Date();
        await leaveRepo.save(leave);
      });

      // Notify employee that leave is in processing
      const leavePayload = {
        id: event.relatedEntityId,
        tenantId: event.tenantId,
      };
      const employee = await this.userRepo.findOne({
        where: { id: event.requestorId },
      });
      if (!employee) return;

      const employeePayload = {
        id: event.requestorId,
        first_name: employee.first_name,
        last_name: employee.last_name,
      };

      // Notify admins about the pending admin approval
      const adminIds = await this.getAdminUserIds(event.tenantId);
      await this.notificationService.notifyLeaveProcessing(
        leavePayload,
        event.finalApproverId!,
        employeePayload,
        adminIds,
      );

      this.logger.log(
        `Leave ${event.relatedEntityId} set to PROCESSING by step approval`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle step approved for leave ${event.relatedEntityId}`,
        error,
      );
    }
  }

  /**
   * All steps approved — leave is fully approved.
   */
  @OnEvent(WORKFLOW_EVENTS.REQUEST_APPROVED, { async: true })
  async handleApproved(event: WorkflowCompletedEvent): Promise<void> {
    if (event.requestType !== (WorkflowRequestType.LEAVE as string)) return;
    if (event.finalApproverId === event.requestorId) {
      this.logger.warn(`User ${event.finalApproverId} attempted to approve their own leave ${event.relatedEntityId} — skipping`);
      return;
    }
    
    const isProvisioned = await this.isTenantSchemaProvisioned(event.tenantId);
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      if (isProvisioned) {
        await queryRunner.query(`SET search_path TO "${event.tenantId}"`);
      }

      const em = queryRunner.manager;
      const leaveRepo = em.getRepository(Leave);
      const balanceRepo = em.getRepository(LeaveBalance);
      const leaveTypeRepo = em.getRepository(LeaveType);

      const leave = await leaveRepo.findOne({
        where: { id: event.relatedEntityId },
      });
      if (!leave) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // Deduct balance BEFORE marking APPROVED so both succeed or both fail
      await this.leaveService.deductLeaveBalance(balanceRepo, leaveTypeRepo, leave, event.tenantId);

      leave.status = LeaveStatus.APPROVED;
      leave.approvedBy = event.finalApproverId!;
      leave.approvedAt = new Date();
      leave.remarks = event.finalRemarks ?? '';
      await leaveRepo.save(leave);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to handle approval for leave ${event.relatedEntityId}`,
        error,
      );
      return;
    } finally {
      await queryRunner.release();
    }

    try {
      const employee = await this.userRepo.findOne({
        where: { id: event.requestorId },
      });
      if (!employee) return;

      const employeePayload = {
        id: event.requestorId,
        first_name: employee.first_name,
        last_name: employee.last_name,
      };
      const leavePayload = {
        id: event.relatedEntityId,
        tenantId: event.tenantId,
      };

      const notification =
        await this.notificationService.notifyLeaveFinalDecision(
          leavePayload,
          event.finalApproverId!,
          employeePayload,
          true,
        );

      this.notificationGateway.sendToUser(
        event.requestorId,
        'new_notification',
        {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          related_entity_type: 'leave',
          related_entity_id: event.relatedEntityId,
          created_at: notification.created_at,
        },
      );

      this.logger.log(`Leave ${event.relatedEntityId} fully APPROVED`);
    } catch (error) {
      this.logger.error(
        `Failed to send notification for leave ${event.relatedEntityId}`,
        error,
      );
    }
  }

  /**
   * Workflow rejected — mark leave as rejected.
   */
  @OnEvent(WORKFLOW_EVENTS.REQUEST_REJECTED, { async: true })
  async handleRejected(event: WorkflowCompletedEvent): Promise<void> {
    if (event.requestType !== (WorkflowRequestType.LEAVE as string)) return;
    try {
      await this.runInTenantContext(event.tenantId, async (leaveRepo, _balanceRepo, _leaveTypeRepo, _em) => {
        const leave = await leaveRepo.findOne({
          where: { id: event.relatedEntityId },
        });
        if (!leave) return;

        leave.status = LeaveStatus.REJECTED;
        leave.approvedBy = event.finalApproverId!;
        leave.approvedAt = new Date();
        leave.remarks = event.finalRemarks ?? '';
        await leaveRepo.save(leave);
      });

      const employee = await this.userRepo.findOne({
        where: { id: event.requestorId },
      });
      if (!employee) return;

      const employeePayload = {
        id: event.requestorId,
        first_name: employee.first_name,
        last_name: employee.last_name,
      };
      const leavePayload = {
        id: event.relatedEntityId,
        tenantId: event.tenantId,
      };

      const notification =
        await this.notificationService.notifyLeaveFinalDecision(
          leavePayload,
          event.finalApproverId!,
          employeePayload,
          false,
        );

      this.notificationGateway.sendToUser(
        event.requestorId,
        'new_notification',
        {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          related_entity_type: 'leave',
          related_entity_id: event.relatedEntityId,
          created_at: notification.created_at,
        },
      );

      this.logger.log(`Leave ${event.relatedEntityId} REJECTED`);
    } catch (error) {
      this.logger.error(
        `Failed to handle rejection for leave ${event.relatedEntityId}`,
        error,
      );
    }
  }

  @OnEvent(WORKFLOW_EVENTS.REQUEST_CANCELLED, { async: true })
  handleCancelled(event: WorkflowCompletedEvent): void {
    if (event.requestType !== (WorkflowRequestType.LEAVE as string)) return;
    // Leave cancellation is initiated from LeaveService.cancelLeave() itself.
    // This handler is a no-op guard — status is already set to CANCELLED.
    this.logger.debug(
      `Leave workflow ${event.workflowRequestId} cancelled event received`,
    );
  }
}
