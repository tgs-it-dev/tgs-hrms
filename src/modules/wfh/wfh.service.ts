import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { Wfh } from '../../entities/wfh.entity';
import { User } from '../../entities/user.entity';
import {
  WfhStatus,
  WorkflowRequestType,
  NotificationType,
  NotificationAction,
  UserRole,
} from '../../common/constants/enums';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { WorkflowService } from '../workflow/workflow.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { CreateWfhDto } from './dto/create-wfh.dto';
import { UpdateWfhDto } from './dto/update-wfh.dto';
import { DocumentUploadService } from '../storage/document-upload.service';
import {
  TenantSettingsService,
  TenantSettingKey,
} from '../tenant-settings/tenant-settings.service';
import { NotificationsEmailService } from '../notifications-email/notifications-email.service';

@Injectable()
export class WfhService {
  private readonly logger = new Logger(WfhService.name);

  constructor(
    @InjectRepository(Wfh)
    private readonly wfhRepo: Repository<Wfh>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly workflowService: WorkflowService,
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
    private readonly tenantDbService: TenantDatabaseService,
    private readonly fileUploadService: DocumentUploadService,
    private readonly tenantSettings: TenantSettingsService,
    private readonly notificationsEmailService: NotificationsEmailService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── Tenant context helpers ────────────────────────────────────────────────

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<
      { schema_provisioned: boolean }[]
    >(`SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`, [
      tenantId,
    ]);
    return result[0]?.schema_provisioned ?? false;
  }

  private async isWorkflowEnabled(tenantId: string): Promise<boolean> {
    return this.tenantSettings.getBoolean(
      tenantId,
      TenantSettingKey.WFH_WORKFLOW_ENABLED,
    );
  }

  private async runInTenantContext<T>(
    tenantId: string,
    work: (wfhRepo: Repository<Wfh>, em: EntityManager | null) => Promise<T>,
  ): Promise<T> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        work(em.getRepository(Wfh), em),
      );
    }
    return work(this.wfhRepo, null);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async createWfhRequest(
    employeeId: string,
    tenantId: string,
    dto: CreateWfhDto,
    files?: Express.Multer.File[],
  ): Promise<Wfh> {
    const workflowEnabled = await this.isWorkflowEnabled(tenantId);
    if (!workflowEnabled) {
      throw new BadRequestException(
        'This request type is not enabled for your org',
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = new Date(dto.start_date);

    if (startDate < today) {
      throw new BadRequestException('Request date cannot be in the past');
    }

    const endDate = new Date(dto.end_date);

    if (endDate < startDate) {
      throw new BadRequestException('end_date cannot be before start_date');
    }

    const savedWfh = await this.runInTenantContext(
      tenantId,
      async (wfhRepo, em) => {
        // Overlap check: reject if any active WFH request spans the requested dates
        const overlap = await wfhRepo
          .createQueryBuilder('w')
          .where('w.employee_id = :employeeId', { employeeId })
          .andWhere('w.tenant_id = :tenantId', { tenantId })
          .andWhere('w.status IN (:...statuses)', {
            statuses: [WfhStatus.PENDING, WfhStatus.APPROVED],
          })
          .andWhere('w.start_date <= :endDate', { endDate: dto.end_date })
          .andWhere('w.end_date >= :startDate', { startDate: dto.start_date })
          .getOne();

        if (overlap) {
          throw new ForbiddenException(
            overlap.status === WfhStatus.APPROVED
              ? 'You already have an approved WFH request that overlaps these dates'
              : 'You already have a pending WFH request that overlaps these dates',
          );
        }

        // Cross-type check: block if any Leave or Overtime request overlaps these dates
        const runQuery = <T>(sql: string, params: unknown[]) =>
          em ? em.query<T>(sql, params) : this.dataSource.query<T>(sql, params);

        const [leaveRows, overtimeRows] = await Promise.all([
          runQuery<{ id: string }[]>(
            `SELECT id FROM leaves
           WHERE "employeeId" = $1 AND "tenantId" = $2
             AND status IN ('pending','processing','approved')
             AND "startDate"::date <= $3::date AND "endDate"::date >= $4::date
           LIMIT 1`,
            [employeeId, tenantId, dto.end_date, dto.start_date],
          ),
          runQuery<{ id: string }[]>(
            `SELECT id FROM overtime_requests
           WHERE employee_id = $1 AND tenant_id = $2
             AND status IN ('pending','approved')
             AND start_date <= $3 AND end_date >= $4
           LIMIT 1`,
            [employeeId, tenantId, dto.end_date, dto.start_date],
          ),
        ]);

        if (leaveRows.length > 0)
          throw new ForbiddenException(
            'You already have a leave request on these dates',
          );
        if (overtimeRows.length > 0)
          throw new ForbiddenException(
            'You already have an overtime request on these dates',
          );

        const wfh = wfhRepo.create({
          employee_id: employeeId,
          tenant_id: tenantId,
          start_date: startDate,
          end_date: endDate,
          reason: dto.reason,
          status: WfhStatus.PENDING,
          attachments: [],
          workflow_request_id: null,
        });
        const savedWfh = await wfhRepo.save(wfh);

        if (files?.length) {
          try {
            savedWfh.attachments = await this.fileUploadService.uploadDocuments(
              files,
              'wfh-documents',
              savedWfh.id,
              employeeId,
            );
            await wfhRepo.save(savedWfh);
          } catch (err: unknown) {
            this.logger.warn(
              `Failed to upload WFH attachments for ${savedWfh.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        try {
          const workflowRequest =
            await this.workflowService.createWorkflowRequest(
              tenantId,
              WorkflowRequestType.WFH,
              savedWfh.id,
              employeeId,
            );
          savedWfh.workflow_request_id = workflowRequest.id;
          await wfhRepo.save(savedWfh);
        } catch (err: unknown) {
          this.logger.error(
            `Failed to create workflow for WFH ${savedWfh.id}`,
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }

        return savedWfh;
      },
    );

    // Notifications run after the transaction commits — any failure here must
    // NOT roll back the WFH record that was already persisted above.
    try {
      const employee = await this.userRepo.findOne({
        where: { id: employeeId },
      });
      const employeeName = employee
        ? `${employee.first_name} ${employee.last_name}`.trim()
        : 'An employee';

      const dateRange =
        dto.start_date === dto.end_date
          ? dto.start_date
          : `${dto.start_date} to ${dto.end_date}`;

      const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
      const schema = isProvisioned
        ? this.tenantDbService.getSchemaName(tenantId)
        : 'public';
      // In provisioned schemas there is no tenant_id column (isolated by schema).
      // In public schema we must filter by tenant_id to scope to the right tenant.
      const tenantFilter = isProvisioned ? '' : ' AND e.tenant_id = $2';
      const params: unknown[] = isProvisioned
        ? [employeeId]
        : [employeeId, tenantId];
      const managerRows = await this.dataSource.query<{ manager_id: string }[]>(
        `SELECT t.manager_id
           FROM "${schema}".employees e
           JOIN "${schema}".teams t ON e.team_id = t.id
          WHERE e.user_id = $1${tenantFilter} LIMIT 1`,
        params,
      );
      const managerId = managerRows[0]?.manager_id;
      if (managerId && managerId !== employeeId) {
        const notification = await this.notificationService.create(
          managerId,
          tenantId,
          `${employeeName} has submitted a WFH request for ${dateRange}`,
          NotificationType.WFH,
          {
            relatedEntityType: 'wfh',
            relatedEntityId: savedWfh.id,
            senderId: employeeId,
            senderRole: UserRole.EMPLOYEE,
            action: NotificationAction.APPLIED,
            isSystem: false,
          },
        );
        this.notificationGateway.sendToUser(managerId, 'new_notification', {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          related_entity_type: 'wfh',
          related_entity_id: savedWfh.id,
          created_at: notification.created_at,
        });
        this.notificationsEmailService.sendFlexRequestNotification(
          managerId,
          employeeId,
          {
            id: savedWfh.id,
            tenantId,
            startDate: savedWfh.start_date,
            endDate: savedWfh.end_date,
            reason: savedWfh.reason,
          },
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to send WFH notification for ${savedWfh.id}`,
        err instanceof Error ? err.message : String(err),
      );
    }

    return savedWfh;
  }

  async getMyWfhRequests(
    employeeId: string,
    tenantId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: Wfh[]; total: number; page: number; limit: number }> {
    return this.runInTenantContext(tenantId, async (wfhRepo) => {
      const [items, total] = await wfhRepo.findAndCount({
        where: { employee_id: employeeId, tenant_id: tenantId },
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return { items, total, page, limit };
    });
  }

  async getAllWfhRequests(
    tenantId: string,
    actorId: string,
    actorRole: string,
    page = 1,
    limit = 20,
    status?: WfhStatus,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ): Promise<{ items: Wfh[]; total: number; page: number; limit: number }> {
    const isManager = actorRole === UserRole.MANAGER;

    return this.runInTenantContext(tenantId, async (wfhRepo, em) => {
      const runQuery = <T>(sql: string, params: unknown[]) =>
        em ? em.query<T>(sql, params) : this.dataSource.query<T>(sql, params);

      let teamMemberIds: string[] | null = null;
      if (isManager) {
        const rows = await runQuery<{ user_id: string }[]>(
          `SELECT e.user_id
             FROM employees e
             JOIN teams t ON e.team_id = t.id
            WHERE t.manager_id = $1 AND e.tenant_id = $2`,
          [actorId, tenantId],
        );
        teamMemberIds = rows.map((r) => r.user_id);
        if (teamMemberIds.length === 0) {
          return { items: [], total: 0, page, limit };
        }
      }

      const qb = wfhRepo
        .createQueryBuilder('w')
        .leftJoinAndSelect('w.employee', 'employee')
        .where('w.tenant_id = :tenantId', { tenantId })
        .orderBy('w.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      if (status) qb.andWhere('w.status = :status', { status });
      if (startDate) qb.andWhere('w.end_date >= :startDate', { startDate });
      if (endDate) qb.andWhere('w.start_date <= :endDate', { endDate });

      if (userId) {
        if (teamMemberIds && !teamMemberIds.includes(userId)) {
          throw new ForbiddenException(
            'You can only filter by employees within your own team',
          );
        }
        qb.andWhere('w.employee_id = :userId', { userId });
      } else if (teamMemberIds) {
        qb.andWhere('w.employee_id IN (:...teamMemberIds)', { teamMemberIds });
      }

      const [items, total] = await qb.getManyAndCount();
      return { items, total, page, limit };
    });
  }

  async getWfhById(id: string, tenantId: string) {
    return this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({
        where: { id, tenant_id: tenantId },
        relations: ['employee'],
      });
      if (!wfh) throw new NotFoundException('WFH request not found');

      const workflow = wfh.workflow_request_id
        ? await this.workflowService.getWorkflowDetailForEntity(id, tenantId)
        : null;

      return { ...wfh, workflow };
    });
  }

  async cancelWfhRequest(
    id: string,
    employeeId: string,
    tenantId: string,
  ): Promise<Wfh> {
    return this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({ where: { id, tenant_id: tenantId } });
      if (!wfh) throw new NotFoundException('WFH request not found');

      if (wfh.employee_id !== employeeId) {
        throw new ForbiddenException(
          'You can only cancel your own WFH requests',
        );
      }

      if (wfh.status !== WfhStatus.PENDING) {
        throw new ForbiddenException(
          `Cannot cancel a WFH request with status "${wfh.status}"`,
        );
      }

      wfh.status = WfhStatus.CANCELLED;
      const saved = await wfhRepo.save(wfh);

      if (wfh.workflow_request_id) {
        await this.workflowService.cancelWorkflowRequest(
          wfh.workflow_request_id,
          tenantId,
          employeeId,
        );
      }

      return saved;
    });
  }

  async editWfhRequest(
    id: string,
    employeeId: string,
    tenantId: string,
    dto: UpdateWfhDto,
    files?: Express.Multer.File[],
  ): Promise<Wfh> {
    return this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({ where: { id, tenant_id: tenantId } });
      if (!wfh) throw new NotFoundException('WFH request not found');

      if (wfh.employee_id !== employeeId) {
        throw new ForbiddenException('You can only edit your own WFH requests');
      }

      if (wfh.status !== WfhStatus.PENDING) {
        throw new ForbiddenException(
          `Only pending WFH requests can be edited. Current status: "${wfh.status}"`,
        );
      }

      const newStart = dto.start_date
        ? new Date(dto.start_date)
        : wfh.start_date;
      const newEnd = dto.end_date ? new Date(dto.end_date) : wfh.end_date;

      if (newEnd < newStart) {
        throw new BadRequestException('end_date cannot be before start_date');
      }

      if (dto.start_date || dto.end_date) {
        const startStr = newStart.toISOString().slice(0, 10);
        const endStr = newEnd.toISOString().slice(0, 10);

        const overlap = await wfhRepo
          .createQueryBuilder('w')
          .where('w.employee_id = :employeeId', { employeeId })
          .andWhere('w.tenant_id = :tenantId', { tenantId })
          .andWhere('w.id != :id', { id })
          .andWhere('w.status IN (:...statuses)', {
            statuses: [WfhStatus.PENDING, WfhStatus.APPROVED],
          })
          .andWhere('w.start_date <= :endDate', { endDate: endStr })
          .andWhere('w.end_date >= :startDate', { startDate: startStr })
          .getOne();

        if (overlap) {
          throw new ForbiddenException(
            overlap.status === WfhStatus.APPROVED
              ? 'You already have an approved WFH request that overlaps these dates'
              : 'You already have a pending WFH request that overlaps these dates',
          );
        }
      }

      wfh.start_date = newStart;
      wfh.end_date = newEnd;
      if (dto.reason !== undefined) wfh.reason = dto.reason;

      if (files?.length) {
        try {
          const uploaded = await this.fileUploadService.uploadDocuments(
            files,
            'wfh-documents',
            wfh.id,
            employeeId,
          );
          wfh.attachments = [...wfh.attachments, ...uploaded];
        } catch (err: unknown) {
          this.logger.warn(
            `Failed to upload WFH attachments for ${wfh.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return wfhRepo.save(wfh);
    });
  }

  async removeWfhAttachment(
    id: string,
    employeeId: string,
    tenantId: string,
    url: string,
  ): Promise<Wfh> {
    return this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({ where: { id, tenant_id: tenantId } });
      if (!wfh) throw new NotFoundException('WFH request not found');

      if (wfh.employee_id !== employeeId) {
        throw new ForbiddenException('You can only edit your own WFH requests');
      }

      if (wfh.status !== WfhStatus.PENDING) {
        throw new ForbiddenException(
          `Only pending WFH requests can be edited. Current status: "${wfh.status}"`,
        );
      }

      const matchedIndex = wfh.attachments.findIndex((a) =>
        this.fileUploadService.sameObject(a, url),
      );
      if (matchedIndex === -1) {
        throw new BadRequestException(
          'Attachment URL not found on this request',
        );
      }

      const storedUrl = wfh.attachments[matchedIndex];
      try {
        await this.fileUploadService.deleteDocument(storedUrl);
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to delete WFH attachment ${storedUrl}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      wfh.attachments = wfh.attachments.filter((_, i) => i !== matchedIndex);
      return wfhRepo.save(wfh);
    });
  }

  // ── Called by WfhWorkflowListener ─────────────────────────────────────────

  async markApproved(
    relatedEntityId: string,
    tenantId: string,
    requestorId: string,
    approverId: string | null,
  ): Promise<void> {
    await this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({
        where: { id: relatedEntityId, tenant_id: tenantId },
      });
      if (!wfh) return;
      wfh.status = WfhStatus.APPROVED;
      await wfhRepo.save(wfh);
      this.logger.log(`WFH ${relatedEntityId} marked APPROVED by workflow`);
    });

    try {
      const notification = await this.notificationService.create(
        requestorId,
        tenantId,
        'Your WFH request has been approved',
        NotificationType.WFH,
        {
          relatedEntityType: 'wfh',
          relatedEntityId,
          senderId: approverId ?? undefined,
          action: NotificationAction.APPROVED,
          isSystem: false,
        },
      );
      this.notificationGateway.sendToUser(requestorId, 'new_notification', {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        related_entity_type: 'wfh',
        related_entity_id: relatedEntityId,
        created_at: notification.created_at,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to send approval notification for WFH ${relatedEntityId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async markRejected(
    relatedEntityId: string,
    tenantId: string,
    requestorId: string,
    approverId: string | null,
  ): Promise<void> {
    await this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({
        where: { id: relatedEntityId, tenant_id: tenantId },
      });
      if (!wfh) return;
      wfh.status = WfhStatus.REJECTED;
      await wfhRepo.save(wfh);
      this.logger.log(`WFH ${relatedEntityId} marked REJECTED by workflow`);
    });

    try {
      const notification = await this.notificationService.create(
        requestorId,
        tenantId,
        'Your WFH request has been rejected',
        NotificationType.WFH,
        {
          relatedEntityType: 'wfh',
          relatedEntityId,
          senderId: approverId ?? undefined,
          action: NotificationAction.REJECTED,
          isSystem: false,
        },
      );
      this.notificationGateway.sendToUser(requestorId, 'new_notification', {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        related_entity_type: 'wfh',
        related_entity_id: relatedEntityId,
        created_at: notification.created_at,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to send rejection notification for WFH ${relatedEntityId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
