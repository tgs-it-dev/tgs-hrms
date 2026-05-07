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
import { WfhStatus, WorkflowRequestType, NotificationType, NotificationAction } from '../../common/constants/enums';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { WorkflowService } from '../workflow/workflow.service';
import { NotificationService } from '../notification/notification.service';
import { CreateWfhDto } from './dto/create-wfh.dto';

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
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── Tenant context helpers ────────────────────────────────────────────────

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<{ schema_provisioned: boolean }[]>(
      `SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
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
  ): Promise<Wfh> {
    const workflowEnabled = await this.isWorkflowEnabled(tenantId);
    if (!workflowEnabled) {
      throw new BadRequestException(
        'WFH requests require the workflow engine to be enabled. Ask your admin to enable it.',
      );
    }

    return this.runInTenantContext(tenantId, async (wfhRepo) => {
      // Check for duplicate WFH on same date
      const wfhDate = new Date(dto.wfh_date);
      const existing = await wfhRepo.findOne({
        where: {
          employee_id: employeeId,
          tenant_id: tenantId,
          wfh_date: wfhDate,
          status: WfhStatus.PENDING,
        },
      });
      if (existing) {
        throw new ForbiddenException('You already have a pending WFH request for this date');
      }

      const wfh = wfhRepo.create({
        employee_id: employeeId,
        tenant_id: tenantId,
        wfh_date: wfhDate,
        reason: dto.reason,
        status: WfhStatus.PENDING,
        workflow_request_id: null,
      });
      const savedWfh = await wfhRepo.save(wfh);

      // Create workflow request
      try {
        const workflowRequest = await this.workflowService.createWorkflowRequest(
          tenantId,
          WorkflowRequestType.WFH,
          savedWfh.id,
          employeeId,
        );
        savedWfh.workflow_request_id = workflowRequest.id;
        await wfhRepo.save(savedWfh);
      } catch (error) {
        this.logger.error(`Failed to create workflow for WFH ${savedWfh.id}`, error);
        throw error;
      }

      // Notify manager via notification service
      try {
        const employee = await this.userRepo.findOne({ where: { id: employeeId } });
        const employeeName = employee
          ? `${employee.first_name} ${employee.last_name}`.trim()
          : 'An employee';

        await this.notificationService.create(
          employeeId,
          tenantId,
          `${employeeName} has submitted a WFH request for ${dto.wfh_date}`,
          NotificationType.IN_APP,
          {
            relatedEntityType: 'wfh',
            relatedEntityId: savedWfh.id,
            senderId: employeeId,
            senderRole: 'employee',
            action: NotificationAction.APPLIED,
            isSystem: false,
          },
        );
      } catch (error) {
        this.logger.warn(`Failed to send WFH notification for ${savedWfh.id}`, error);
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
        throw new ForbiddenException('You can only cancel your own WFH requests');
      }

      if (wfh.status !== WfhStatus.PENDING) {
        throw new ForbiddenException(`Cannot cancel a WFH request with status "${wfh.status}"`);
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

  // ── Called by WfhWorkflowListener ─────────────────────────────────────────

  async markApproved(relatedEntityId: string, tenantId: string, _approverId: string | null): Promise<void> {
    await this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({ where: { id: relatedEntityId, tenant_id: tenantId } });
      if (!wfh) return;
      wfh.status = WfhStatus.APPROVED;
      await wfhRepo.save(wfh);
      this.logger.log(`WFH ${relatedEntityId} marked APPROVED by workflow`);
    });
  }

  async markRejected(relatedEntityId: string, tenantId: string, _approverId: string | null): Promise<void> {
    await this.runInTenantContext(tenantId, async (wfhRepo) => {
      const wfh = await wfhRepo.findOne({ where: { id: relatedEntityId, tenant_id: tenantId } });
      if (!wfh) return;
      wfh.status = WfhStatus.REJECTED;
      await wfhRepo.save(wfh);
      this.logger.log(`WFH ${relatedEntityId} marked REJECTED by workflow`);
    });
  }
}
