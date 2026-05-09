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
import { CreateWfhDto } from './dto/create-wfh.dto';
import { UpdateWfhDto } from './dto/update-wfh.dto';
import { DocumentUploadService } from '../storage/document-upload.service';

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
    private readonly tenantDbService: TenantDatabaseService,
    private readonly fileUploadService: DocumentUploadService,
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
    const result = await this.dataSource.query<{ workflow_enabled: boolean }[]>(
      `SELECT workflow_enabled FROM public.tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    return result[0]?.workflow_enabled ?? false;
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
        'WFH requests require the workflow engine to be enabled. Ask your admin to enable it.',
      );
    }

    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    if (endDate < startDate) {
      throw new BadRequestException('end_date cannot be before start_date');
    }

    return this.runInTenantContext(tenantId, async (wfhRepo) => {
      // Overlap check: reject if any active request spans any of the requested dates
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

        await this.notificationService.create(
          employeeId,
          tenantId,
          `${employeeName} has submitted a WFH request for ${dateRange}`,
          NotificationType.IN_APP,
          {
            relatedEntityType: WorkflowRequestType.WFH,
            relatedEntityId: savedWfh.id,
            senderId: employeeId,
            senderRole: UserRole.EMPLOYEE,
            action: NotificationAction.APPLIED,
            isSystem: false,
          },
        );
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to send WFH notification for ${savedWfh.id}`,
          err instanceof Error ? err.message : String(err),
        );
      }

      return savedWfh;
    });
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
    page = 1,
    limit = 20,
    status?: WfhStatus,
  ): Promise<{ items: Wfh[]; total: number; page: number; limit: number }> {
    return this.runInTenantContext(tenantId, async (wfhRepo) => {
      const where: Record<string, unknown> = { tenant_id: tenantId };
      if (status) where.status = status;

      const [items, total] = await wfhRepo.findAndCount({
        where,
        relations: ['employee'],
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return { items, total, page, limit };
    });
  }

  async getWfhById(id: string, tenantId: string): Promise<Wfh> {
    return this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({
        where: { id, tenant_id: tenantId },
        relations: ['employee'],
      });
      if (!wfh) throw new NotFoundException('WFH request not found');
      return wfh;
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

      if (!wfh.attachments.includes(url)) {
        throw new BadRequestException(
          'Attachment URL not found on this request',
        );
      }

      try {
        await this.fileUploadService.deleteDocument(url);
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to delete WFH attachment ${url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      wfh.attachments = wfh.attachments.filter((a) => a !== url);
      return wfhRepo.save(wfh);
    });
  }

  // ── Called by WfhWorkflowListener ─────────────────────────────────────────

  async markApproved(relatedEntityId: string, tenantId: string): Promise<void> {
    await this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({
        where: { id: relatedEntityId, tenant_id: tenantId },
      });
      if (!wfh) return;
      wfh.status = WfhStatus.APPROVED;
      await wfhRepo.save(wfh);
      this.logger.log(`WFH ${relatedEntityId} marked APPROVED by workflow`);
    });
  }

  async markRejected(relatedEntityId: string, tenantId: string): Promise<void> {
    await this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({
        where: { id: relatedEntityId, tenant_id: tenantId },
      });
      if (!wfh) return;
      wfh.status = WfhStatus.REJECTED;
      await wfhRepo.save(wfh);
      this.logger.log(`WFH ${relatedEntityId} marked REJECTED by workflow`);
    });
  }
}
