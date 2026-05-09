import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { Overtime } from '../../entities/overtime.entity';
import { User } from '../../entities/user.entity';
import {
  OvertimeStatus,
  WorkflowRequestType,
  NotificationType,
  NotificationAction,
  UserRole,
} from '../../common/constants/enums';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { WorkflowService } from '../workflow/workflow.service';
import { NotificationService } from '../notification/notification.service';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { UpdateOvertimeDto } from './dto/update-overtime.dto';
import { DocumentUploadService } from '../storage/document-upload.service';

@Injectable()
export class OvertimeService {
  private readonly logger = new Logger(OvertimeService.name);

  constructor(
    @InjectRepository(Overtime)
    private readonly overtimeRepo: Repository<Overtime>,
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
    work: (repo: Repository<Overtime>, em: EntityManager | null) => Promise<T>,
  ): Promise<T> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        work(em.getRepository(Overtime), em),
      );
    }
    return work(this.overtimeRepo, null);
  }

  /**
   * Returns the first weekday (Mon–Fri) found in [startDate, endDate], or null if all days are weekend.
   * Used to give a precise error message pointing to the offending date.
   */
  private findWeekdayInRange(startDate: Date, endDate: Date): Date | null {
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const day = cursor.getUTCDay();
      if (day !== 0 && day !== 6) return new Date(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return null;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async createOvertimeRequest(
    employeeId: string,
    tenantId: string,
    dto: CreateOvertimeDto,
    files?: Express.Multer.File[],
  ): Promise<Overtime> {
    const workflowEnabled = await this.isWorkflowEnabled(tenantId);
    if (!workflowEnabled) {
      throw new BadRequestException(
        'Overtime requests require the workflow engine to be enabled. Ask your admin to enable it.',
      );
    }

    const hasHours = dto.hours !== undefined;
    const hasEndDate = dto.end_date !== undefined;

    if (hasHours && hasEndDate) {
      throw new BadRequestException(
        'Provide either hours (single-day mode) or end_date (range mode), not both.',
      );
    }
    if (!hasHours && !hasEndDate) {
      throw new BadRequestException(
        'Provide either hours with start_date (single-day) or start_date with end_date (range).',
      );
    }

    const startDate = new Date(dto.start_date);
    let endDate: Date;
    let hours: number;

    if (hasHours) {
      // ── Hours mode: single day ────────────────────────────────────────────
      const dayOfWeek = startDate.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        throw new BadRequestException(
          `Overtime can only be requested on weekends. ${dto.start_date} is a weekday.`,
        );
      }
      endDate = new Date(startDate);
      hours = dto.hours!;
    } else {
      // ── Range mode: start_date → end_date ─────────────────────────────────
      endDate = new Date(dto.end_date!);

      if (endDate < startDate) {
        throw new BadRequestException('end_date cannot be before start_date');
      }

      const weekday = this.findWeekdayInRange(startDate, endDate);
      if (weekday) {
        throw new BadRequestException(
          `Overtime can only cover weekends. ${weekday.toISOString().slice(0, 10)} is a weekday.`,
        );
      }

      const totalDays =
        Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
      hours = totalDays * 8;
    }

    return this.runInTenantContext(tenantId, async (repo) => {
      // Overlap check against active requests
      const overlap = await repo
        .createQueryBuilder('o')
        .where('o.employee_id = :employeeId', { employeeId })
        .andWhere('o.tenant_id = :tenantId', { tenantId })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [OvertimeStatus.PENDING, OvertimeStatus.APPROVED],
        })
        .andWhere('o.start_date <= :endDate', {
          endDate: endDate.toISOString().slice(0, 10),
        })
        .andWhere('o.end_date >= :startDate', {
          startDate: dto.start_date,
        })
        .getOne();

      if (overlap) {
        throw new ForbiddenException(
          overlap.status === OvertimeStatus.APPROVED
            ? 'You already have an approved overtime request that overlaps these dates'
            : 'You already have a pending overtime request that overlaps these dates',
        );
      }

      const overtime = repo.create({
        employee_id: employeeId,
        tenant_id: tenantId,
        start_date: startDate,
        end_date: endDate,
        hours,
        reason: dto.reason,
        status: OvertimeStatus.PENDING,
        attachments: [],
        workflow_request_id: null,
      });
      const saved = await repo.save(overtime);

      if (files && files.length > 0) {
        try {
          saved.attachments = await this.fileUploadService.uploadDocuments(
            files,
            'overtime-documents',
            saved.id,
            employeeId,
          );
          await repo.save(saved);
        } catch (err: unknown) {
          this.logger.warn(
            `Failed to upload overtime attachments for ${saved.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      try {
        const workflowRequest =
          await this.workflowService.createWorkflowRequest(
            tenantId,
            WorkflowRequestType.OVERTIME,
            saved.id,
            employeeId,
          );
        saved.workflow_request_id = workflowRequest.id;
        await repo.save(saved);
      } catch (err: unknown) {
        this.logger.error(
          `Failed to create workflow for overtime ${saved.id}`,
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

        const startLabel = startDate.toISOString().slice(0, 10);
        const endLabel = endDate.toISOString().slice(0, 10);
        const dateRange =
          startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;

        await this.notificationService.create(
          employeeId,
          tenantId,
          `${employeeName} submitted an overtime request for ${dateRange} (${hours}h)`,
          NotificationType.IN_APP,
          {
            relatedEntityType: WorkflowRequestType.OVERTIME,
            relatedEntityId: saved.id,
            senderId: employeeId,
            senderRole: UserRole.EMPLOYEE,
            action: NotificationAction.APPLIED,
            isSystem: false,
          },
        );
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to send overtime notification for ${saved.id}`,
          err instanceof Error ? err.message : String(err),
        );
      }

      return saved;
    });
  }

  async getMyOvertimeRequests(
    employeeId: string,
    tenantId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    items: Overtime[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.runInTenantContext(tenantId, async (repo) => {
      const [items, total] = await repo.findAndCount({
        where: { employee_id: employeeId, tenant_id: tenantId },
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return { items, total, page, limit };
    });
  }

  async getAllOvertimeRequests(
    tenantId: string,
    page = 1,
    limit = 20,
    status?: OvertimeStatus,
  ): Promise<{
    items: Overtime[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.runInTenantContext(tenantId, async (repo) => {
      const where: Record<string, unknown> = { tenant_id: tenantId };
      if (status) where.status = status;

      const [items, total] = await repo.findAndCount({
        where,
        relations: ['employee'],
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return { items, total, page, limit };
    });
  }

  async getOvertimeById(id: string, tenantId: string): Promise<Overtime> {
    return this.runInTenantContext(tenantId, async (repo) => {
      const overtime = await repo.findOne({
        where: { id, tenant_id: tenantId },
        relations: ['employee'],
      });
      if (!overtime) throw new NotFoundException('Overtime request not found');
      return overtime;
    });
  }

  async cancelOvertimeRequest(
    id: string,
    employeeId: string,
    tenantId: string,
  ): Promise<Overtime> {
    return this.runInTenantContext(tenantId, async (repo) => {
      const overtime = await repo.findOne({
        where: { id, tenant_id: tenantId },
      });
      if (!overtime) throw new NotFoundException('Overtime request not found');

      if (overtime.employee_id !== employeeId) {
        throw new ForbiddenException(
          'You can only cancel your own overtime requests',
        );
      }

      if (overtime.status !== OvertimeStatus.PENDING) {
        throw new ForbiddenException(
          `Cannot cancel an overtime request with status "${overtime.status}"`,
        );
      }

      overtime.status = OvertimeStatus.CANCELLED;
      const saved = await repo.save(overtime);

      if (overtime.workflow_request_id) {
        await this.workflowService.cancelWorkflowRequest(
          overtime.workflow_request_id,
          tenantId,
          employeeId,
        );
      }

      return saved;
    });
  }

  async editOvertimeRequest(
    id: string,
    employeeId: string,
    tenantId: string,
    dto: UpdateOvertimeDto,
    files?: Express.Multer.File[],
  ): Promise<Overtime> {
    const hasHours = dto.hours !== undefined;
    const hasEndDate = dto.end_date !== undefined;

    if (hasHours && hasEndDate) {
      throw new BadRequestException(
        'Provide either hours (single-day mode) or end_date (range mode), not both.',
      );
    }

    return this.runInTenantContext(tenantId, async (repo) => {
      const overtime = await repo.findOne({
        where: { id, tenant_id: tenantId },
      });
      if (!overtime) throw new NotFoundException('Overtime request not found');

      if (overtime.employee_id !== employeeId) {
        throw new ForbiddenException(
          'You can only edit your own overtime requests',
        );
      }

      if (overtime.status !== OvertimeStatus.PENDING) {
        throw new ForbiddenException(
          `Only pending overtime requests can be edited. Current status: "${overtime.status}"`,
        );
      }

      const newStart = dto.start_date
        ? new Date(dto.start_date)
        : overtime.start_date;

      if (hasHours) {
        // ── Hours mode ────────────────────────────────────────────────────────
        const dayOfWeek = newStart.getUTCDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          throw new BadRequestException(
            `Overtime can only be requested on weekends. ${newStart.toISOString().slice(0, 10)} is a weekday.`,
          );
        }
        overtime.start_date = newStart;
        overtime.end_date = newStart;
        overtime.hours = dto.hours!;
      } else if (hasEndDate) {
        // ── Range mode ────────────────────────────────────────────────────────
        const newEnd = new Date(dto.end_date!);
        if (newEnd < newStart) {
          throw new BadRequestException('end_date cannot be before start_date');
        }
        const weekday = this.findWeekdayInRange(newStart, newEnd);
        if (weekday) {
          throw new BadRequestException(
            `Overtime can only cover weekends. ${weekday.toISOString().slice(0, 10)} is a weekday.`,
          );
        }
        const totalDays =
          Math.round((newEnd.getTime() - newStart.getTime()) / 86_400_000) + 1;
        overtime.start_date = newStart;
        overtime.end_date = newEnd;
        overtime.hours = totalDays * 8;
      } else if (dto.start_date) {
        // ── start_date only — keep existing mode ──────────────────────────────
        const existingEnd = overtime.end_date;
        const isSingleDay =
          overtime.start_date.toISOString().slice(0, 10) ===
          overtime.end_date.toISOString().slice(0, 10);

        if (isSingleDay) {
          const dayOfWeek = newStart.getUTCDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            throw new BadRequestException(
              `Overtime can only be requested on weekends. ${newStart.toISOString().slice(0, 10)} is a weekday.`,
            );
          }
          overtime.start_date = newStart;
          overtime.end_date = newStart;
        } else {
          const weekday = this.findWeekdayInRange(newStart, existingEnd);
          if (weekday) {
            throw new BadRequestException(
              `Overtime can only cover weekends. ${weekday.toISOString().slice(0, 10)} is a weekday.`,
            );
          }
          const totalDays =
            Math.round(
              (existingEnd.getTime() - newStart.getTime()) / 86_400_000,
            ) + 1;
          overtime.start_date = newStart;
          overtime.hours = totalDays * 8;
        }
      }

      if (dto.reason !== undefined) overtime.reason = dto.reason;

      // ── Overlap check (only when dates changed) ───────────────────────────
      if (dto.start_date || hasEndDate) {
        const startStr = overtime.start_date.toISOString().slice(0, 10);
        const endStr = overtime.end_date.toISOString().slice(0, 10);

        const overlap = await repo
          .createQueryBuilder('o')
          .where('o.employee_id = :employeeId', { employeeId })
          .andWhere('o.tenant_id = :tenantId', { tenantId })
          .andWhere('o.id != :id', { id })
          .andWhere('o.status IN (:...statuses)', {
            statuses: [OvertimeStatus.PENDING, OvertimeStatus.APPROVED],
          })
          .andWhere('o.start_date <= :endDate', { endDate: endStr })
          .andWhere('o.end_date >= :startDate', { startDate: startStr })
          .getOne();

        if (overlap) {
          throw new ForbiddenException(
            overlap.status === OvertimeStatus.APPROVED
              ? 'You already have an approved overtime request that overlaps these dates'
              : 'You already have a pending overtime request that overlaps these dates',
          );
        }
      }

      // ── New attachment upload ─────────────────────────────────────────────
      if (files?.length) {
        try {
          const uploaded = await this.fileUploadService.uploadDocuments(
            files,
            'overtime-documents',
            overtime.id,
            employeeId,
          );
          overtime.attachments = [...overtime.attachments, ...uploaded];
        } catch (err: unknown) {
          this.logger.warn(
            `Failed to upload overtime attachments for ${overtime.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return repo.save(overtime);
    });
  }

  async removeOvertimeAttachment(
    id: string,
    employeeId: string,
    tenantId: string,
    url: string,
  ): Promise<Overtime> {
    return this.runInTenantContext(tenantId, async (repo) => {
      const overtime = await repo.findOne({
        where: { id, tenant_id: tenantId },
      });
      if (!overtime) throw new NotFoundException('Overtime request not found');

      if (overtime.employee_id !== employeeId) {
        throw new ForbiddenException(
          'You can only edit your own overtime requests',
        );
      }

      if (overtime.status !== OvertimeStatus.PENDING) {
        throw new ForbiddenException(
          `Only pending overtime requests can be edited. Current status: "${overtime.status}"`,
        );
      }

      if (!overtime.attachments.includes(url)) {
        throw new BadRequestException(
          'Attachment URL not found on this request',
        );
      }

      try {
        await this.fileUploadService.deleteDocument(url);
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to delete overtime attachment ${url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      overtime.attachments = overtime.attachments.filter((a) => a !== url);
      return repo.save(overtime);
    });
  }

  // ── Called by OvertimeWorkflowListener ───────────────────────────────────

  async markApproved(relatedEntityId: string, tenantId: string): Promise<void> {
    await this.runInTenantContext(tenantId, async (repo) => {
      const overtime = await repo.findOne({
        where: { id: relatedEntityId, tenant_id: tenantId },
      });
      if (!overtime) return;
      overtime.status = OvertimeStatus.APPROVED;
      await repo.save(overtime);
      this.logger.log(
        `Overtime ${relatedEntityId} marked APPROVED by workflow`,
      );
    });
  }

  async markRejected(relatedEntityId: string, tenantId: string): Promise<void> {
    await this.runInTenantContext(tenantId, async (repo) => {
      const overtime = await repo.findOne({
        where: { id: relatedEntityId, tenant_id: tenantId },
      });
      if (!overtime) return;
      overtime.status = OvertimeStatus.REJECTED;
      await repo.save(overtime);
      this.logger.log(
        `Overtime ${relatedEntityId} marked REJECTED by workflow`,
      );
    });
  }
}
