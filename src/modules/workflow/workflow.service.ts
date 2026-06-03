import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { WorkflowConfig } from '../../entities/workflow-config.entity';
import { WorkflowRequest } from '../../entities/workflow-request.entity';
import { WorkflowStep } from '../../entities/workflow-step.entity';
import { FlexRequestAudit } from '../../entities/flex-request-audit.entity';
import {
  WorkflowRequestType,
  WorkflowRequestStatus,
  WorkflowStepStatus,
} from '../../common/constants/enums';
import {
  TenantSettingsService,
  TenantSettingKey,
} from '../tenant-settings/tenant-settings.service';

export type WorkflowActor = {
  id: string;
  first_name: string;
  last_name: string;
};

export type WorkflowStepDetail = {
  id: string;
  step_order: number;
  approver_role: string;
  step_label: string;
  status: WorkflowStepStatus;
  approver_id: string | null;
  remarks: string | null;
  acted_at: Date | null;
  approver: WorkflowActor | null;
};

export type WorkflowSummary = {
  id: string;
  status: WorkflowRequestStatus;
  request_type: WorkflowRequestType;
  current_step_order: number;
  total_steps: number;
  requestor: WorkflowActor | null;
  steps: WorkflowStepDetail[];
};

type EnrichedStep = WorkflowStep & { approver: WorkflowActor | null };

export type WorkflowSettingsResponse = {
  leave_workflow_enabled: boolean;
  wfh_workflow_enabled: boolean;
  overtime_workflow_enabled: boolean;
};

export type EnrichedRequest = WorkflowRequest & {
  requestor: WorkflowActor | null;
  request_data: Record<string, unknown> | null;
  steps: EnrichedStep[];
};
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { AddWorkflowConfigStepDto } from './dto/add-workflow-config-step.dto';
import { UpdateWorkflowConfigStepDto } from './dto/update-workflow-config-step.dto';
import { StepAction } from './dto/act-on-step.dto';
import {
  WORKFLOW_EVENTS,
  DEFAULT_WORKFLOW_CONFIGS,
} from './constants/workflow.constants';
import { WorkflowCompletedEvent } from './events/workflow-completed.event';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    @InjectRepository(WorkflowConfig)
    private readonly configRepo: Repository<WorkflowConfig>,
    @InjectRepository(WorkflowRequest)
    private readonly requestRepo: Repository<WorkflowRequest>,
    @InjectRepository(WorkflowStep)
    private readonly stepRepo: Repository<WorkflowStep>,
    @InjectRepository(FlexRequestAudit)
    private readonly auditRepo: Repository<FlexRequestAudit>,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenantDbService: TenantDatabaseService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly tenantSettings: TenantSettingsService,
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

  private async runInTenantContext<T>(
    tenantId: string,
    work: (
      configRepo: Repository<WorkflowConfig>,
      requestRepo: Repository<WorkflowRequest>,
      stepRepo: Repository<WorkflowStep>,
      em: EntityManager | null,
    ) => Promise<T>,
  ): Promise<T> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        work(
          em.getRepository(WorkflowConfig),
          em.getRepository(WorkflowRequest),
          em.getRepository(WorkflowStep),
          em,
        ),
      );
    }
    return work(this.configRepo, this.requestRepo, this.stepRepo, null);
  }

  // ── Config management ─────────────────────────────────────────────────────

  async getWorkflowConfigs(
    tenantId: string,
    requestType?: WorkflowRequestType,
  ): Promise<WorkflowConfig[]> {
    return this.runInTenantContext(tenantId, async (configRepo) => {
      const where: Record<string, unknown> = { tenant_id: tenantId };
      if (requestType) where.request_type = requestType;
      return configRepo.find({
        where,
        order: { request_type: 'ASC', step_order: 'ASC' },
      });
    });
  }

  async addWorkflowConfigStep(
    tenantId: string,
    dto: AddWorkflowConfigStepDto,
  ): Promise<WorkflowConfig[]> {
    return this.runInTenantContext(tenantId, async (configRepo) => {
      const existing = await configRepo.find({
        where: { tenant_id: tenantId, request_type: dto.request_type },
        order: { step_order: 'ASC' },
      });

      const nextOrder =
        existing.length > 0 ? existing[existing.length - 1].step_order + 1 : 1;

      const created = configRepo.create({
        tenant_id: tenantId,
        request_type: dto.request_type,
        step_order: nextOrder,
        approver_role: dto.approver_role,
        step_label: dto.step_label,
        is_active: dto.is_active ?? true,
      });

      await configRepo.save(created);
      return [...existing, created].sort((a, b) => a.step_order - b.step_order);
    });
  }

  async updateWorkflowConfigStep(
    tenantId: string,
    requestType: WorkflowRequestType,
    stepOrder: number,
    dto: UpdateWorkflowConfigStepDto,
  ): Promise<WorkflowConfig> {
    if (
      dto.approver_role === undefined &&
      dto.step_label === undefined &&
      dto.is_active === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one field to update: approver_role, step_label, or is_active',
      );
    }

    return this.runInTenantContext(tenantId, async (configRepo) => {
      const step = await configRepo.findOne({
        where: {
          tenant_id: tenantId,
          request_type: requestType,
          step_order: stepOrder,
        },
      });
      if (!step) {
        throw new NotFoundException(
          `No config step found for ${requestType} step_order ${stepOrder}`,
        );
      }

      if (dto.approver_role !== undefined)
        step.approver_role = dto.approver_role;
      if (dto.step_label !== undefined) step.step_label = dto.step_label;
      if (dto.is_active !== undefined) step.is_active = dto.is_active;

      return configRepo.save(step);
    });
  }

  async deleteWorkflowConfigStep(
    tenantId: string,
    requestType: WorkflowRequestType,
    stepOrder: number,
  ): Promise<WorkflowConfig[]> {
    return this.runInTenantContext(tenantId, async (configRepo) => {
      const step = await configRepo.findOne({
        where: {
          tenant_id: tenantId,
          request_type: requestType,
          step_order: stepOrder,
        },
      });
      if (!step) {
        throw new NotFoundException(
          `No config step found for ${requestType} step_order ${stepOrder}`,
        );
      }

      const all = await configRepo.find({
        where: { tenant_id: tenantId, request_type: requestType },
        order: { step_order: 'ASC' },
      });
      if (all.length === 1) {
        throw new BadRequestException(
          'Cannot delete the last step — a workflow must have at least one step',
        );
      }

      await configRepo.remove(step);

      const remaining = all
        .filter((r) => r.step_order !== stepOrder)
        .sort((a, b) => a.step_order - b.step_order);

      for (let i = 0; i < remaining.length; i++) {
        remaining[i].step_order = i + 1;
      }
      return (await configRepo.save(remaining)).sort(
        (a, b) => a.step_order - b.step_order,
      );
    });
  }

  async seedDefaultConfigsForTenant(tenantId: string): Promise<void> {
    for (const [requestType, steps] of Object.entries(
      DEFAULT_WORKFLOW_CONFIGS,
    )) {
      for (const step of steps) {
        const exists = await this.configRepo.findOne({
          where: {
            tenant_id: tenantId,
            request_type: requestType as WorkflowRequestType,
            step_order: step.step_order,
          },
        });
        if (!exists) {
          await this.configRepo.save(
            this.configRepo.create({
              tenant_id: tenantId,
              request_type: requestType as WorkflowRequestType,
              step_order: step.step_order,
              approver_role: step.approver_role,
              step_label: step.step_label,
              is_active: true,
            }),
          );
        }
      }
    }
    this.logger.log(`Seeded default workflow configs for tenant ${tenantId}`);
  }

  private async getConfigSteps(
    tenantId: string,
    requestType: WorkflowRequestType,
    configRepo: Repository<WorkflowConfig>,
  ): Promise<
    Array<{ step_order: number; approver_role: string; step_label: string }>
  > {
    const rows = await configRepo.find({
      where: {
        tenant_id: tenantId,
        request_type: requestType,
        is_active: true,
      },
      order: { step_order: 'ASC' },
    });

    if (rows.length > 0) {
      return rows.map((r) => ({
        step_order: r.step_order,
        approver_role: r.approver_role,
        step_label: r.step_label,
      }));
    }

    // Fall back to hardcoded defaults if tenant has no config yet
    this.logger.warn(
      `No workflow config found for tenant ${tenantId} type ${requestType} — using defaults`,
    );
    return DEFAULT_WORKFLOW_CONFIGS[requestType] ?? [];
  }

  // ── Workflow request lifecycle ────────────────────────────────────────────

  async createWorkflowRequest(
    tenantId: string,
    requestType: WorkflowRequestType,
    relatedEntityId: string,
    requestorId: string,
  ): Promise<WorkflowRequest> {
    return this.runInTenantContext(
      tenantId,
      async (configRepo, requestRepo, stepRepo) => {
        const configSteps = await this.getConfigSteps(
          tenantId,
          requestType,
          configRepo,
        );

        if (configSteps.length === 0) {
          throw new BadRequestException(
            `No workflow configuration found for type "${requestType}"`,
          );
        }

        const workflowRequest = requestRepo.create({
          tenant_id: tenantId,
          request_type: requestType,
          related_entity_id: relatedEntityId,
          requestor_id: requestorId,
          status: WorkflowRequestStatus.PENDING,
          current_step_order: 1,
          total_steps: configSteps.length,
        });
        const savedRequest = await requestRepo.save(workflowRequest);

        const steps = configSteps.map((cfg) =>
          stepRepo.create({
            workflow_request_id: savedRequest.id,
            tenant_id: tenantId,
            step_order: cfg.step_order,
            approver_role: cfg.approver_role,
            step_label: cfg.step_label,
            status: WorkflowStepStatus.PENDING,
            approver_id: null,
            remarks: null,
            acted_at: null,
          }),
        );
        await stepRepo.save(steps);

        savedRequest.steps = steps;
        this.logger.log(
          `Created workflow request ${savedRequest.id} for ${requestType} entity ${relatedEntityId}`,
        );
        return savedRequest;
      },
    );
  }

  async actOnCurrentStep(
    workflowRequestId: string,
    actorId: string,
    actorRole: string,
    tenantId: string,
    action: StepAction,
    remarks?: string,
  ): Promise<WorkflowRequest> {
    return this.runInTenantContext(
      tenantId,
      async (_configRepo, requestRepo, stepRepo) => {
        const workflowRequest = await requestRepo.findOne({
          where: { id: workflowRequestId, tenant_id: tenantId },
          relations: ['steps'],
        });

        if (!workflowRequest) {
          throw new NotFoundException('Workflow request not found');
        }

        if (
          workflowRequest.status !== WorkflowRequestStatus.PENDING &&
          workflowRequest.status !== WorkflowRequestStatus.IN_REVIEW
        ) {
          throw new BadRequestException(
            `Workflow request is already ${workflowRequest.status}`,
          );
        }

        const currentStep = workflowRequest.steps.find(
          (s) =>
            s.step_order === workflowRequest.current_step_order &&
            s.status === WorkflowStepStatus.PENDING,
        );

        if (!currentStep) {
          throw new BadRequestException(
            'No pending step found for the current level',
          );
        }

        // Prevent self-approval
        if (actorId === workflowRequest.requestor_id) {
          throw new ForbiddenException(
            'You cannot approve or decline your own request',
          );
        }

        // Validate that the actor has the correct role for this step
        if (
          currentStep.approver_role.toLowerCase() !== actorRole.toLowerCase()
        ) {
          throw new ForbiddenException(
            `This step requires the "${currentStep.approver_role}" role. Your role is "${actorRole}".`,
          );
        }

        // Update the step
        currentStep.status =
          action === StepAction.APPROVED
            ? WorkflowStepStatus.APPROVED
            : WorkflowStepStatus.REJECTED;
        currentStep.approver_id = actorId;
        currentStep.remarks = remarks ?? null;
        currentStep.acted_at = new Date();
        await stepRepo.save(currentStep);

        const event = new WorkflowCompletedEvent(
          workflowRequest.id,
          workflowRequest.related_entity_id,
          workflowRequest.request_type,
          tenantId,
          workflowRequest.requestor_id,
          action === StepAction.REJECTED ? 'rejected' : 'approved',
          actorId,
          remarks ?? null,
        );

        const previousStatus = workflowRequest.status;

        if (action === StepAction.REJECTED) {
          workflowRequest.status = WorkflowRequestStatus.REJECTED;
          await requestRepo.save(workflowRequest);
          await this.writeAudit(
            workflowRequest.id,
            tenantId,
            actorId,
            previousStatus,
            WorkflowRequestStatus.REJECTED,
            remarks ?? null,
          );
          this.eventEmitter.emit(WORKFLOW_EVENTS.REQUEST_REJECTED, event);
          this.logger.log(
            `Workflow ${workflowRequestId} rejected at step ${currentStep.step_order}`,
          );
        } else {
          const isLastStep =
            workflowRequest.current_step_order >= workflowRequest.total_steps;

          if (isLastStep) {
            workflowRequest.status = WorkflowRequestStatus.APPROVED;
            await requestRepo.save(workflowRequest);
            await this.writeAudit(
              workflowRequest.id,
              tenantId,
              actorId,
              previousStatus,
              WorkflowRequestStatus.APPROVED,
              remarks ?? null,
            );
            this.eventEmitter.emit(WORKFLOW_EVENTS.REQUEST_APPROVED, event);
            this.logger.log(`Workflow ${workflowRequestId} fully approved`);
          } else {
            workflowRequest.current_step_order += 1;
            workflowRequest.status = WorkflowRequestStatus.IN_REVIEW;
            await requestRepo.save(workflowRequest);
            await this.writeAudit(
              workflowRequest.id,
              tenantId,
              actorId,
              previousStatus,
              WorkflowRequestStatus.IN_REVIEW,
              remarks ?? null,
            );

            const stepApprovedEvent = new WorkflowCompletedEvent(
              workflowRequest.id,
              workflowRequest.related_entity_id,
              workflowRequest.request_type,
              tenantId,
              workflowRequest.requestor_id,
              'step_approved',
              actorId,
              remarks ?? null,
            );
            this.eventEmitter.emit(
              WORKFLOW_EVENTS.STEP_APPROVED,
              stepApprovedEvent,
            );
            this.logger.log(
              `Workflow ${workflowRequestId} step ${currentStep.step_order} approved, advancing to step ${workflowRequest.current_step_order}`,
            );
          }
        }

        const result = await requestRepo.findOne({
          where: { id: workflowRequestId },
          relations: ['steps'],
          order: { steps: { step_order: 'ASC' } },
        });
        if (result) {
          result.steps = this.truncateStepsAtRejection(result.steps ?? []);
        }
        return result as WorkflowRequest;
      },
    );
  }

  async cancelWorkflowRequest(
    workflowRequestId: string,
    tenantId: string,
    actorId: string,
  ): Promise<void> {
    return this.runInTenantContext(
      tenantId,
      async (_configRepo, requestRepo) => {
        const workflowRequest = await requestRepo.findOne({
          where: { id: workflowRequestId, tenant_id: tenantId },
        });

        if (!workflowRequest) return; // Already gone — idempotent

        if (
          workflowRequest.status === WorkflowRequestStatus.APPROVED ||
          workflowRequest.status === WorkflowRequestStatus.REJECTED
        ) {
          return; // Terminal — cannot cancel
        }

        const prevStatus = workflowRequest.status;
        workflowRequest.status = WorkflowRequestStatus.CANCELLED;
        await requestRepo.save(workflowRequest);
        await this.writeAudit(
          workflowRequest.id,
          tenantId,
          actorId,
          prevStatus,
          WorkflowRequestStatus.CANCELLED,
          null,
        );

        const event = new WorkflowCompletedEvent(
          workflowRequest.id,
          workflowRequest.related_entity_id,
          workflowRequest.request_type,
          tenantId,
          workflowRequest.requestor_id,
          'cancelled',
          actorId,
          null,
        );
        this.eventEmitter.emit(WORKFLOW_EVENTS.REQUEST_CANCELLED, event);
        this.logger.log(
          `Workflow ${workflowRequestId} cancelled by ${actorId}`,
        );
      },
    );
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getPendingStepsForRole(
    tenantId: string,
    actorId: string,
    actorRole: string,
    view: 'pending' | 'history' | 'all' = 'pending',
    requestType?: WorkflowRequestType,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<{
    items: EnrichedRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
    let requestorIds: string[] | null = null;
    if (search?.trim()) {
      const pattern = `%${search.trim()}%`;
      const users = await this.dataSource.query<{ id: string }[]>(
        `SELECT id FROM public.users
         WHERE tenant_id = $1
           AND (LOWER(first_name) LIKE LOWER($2)
                OR LOWER(last_name) LIKE LOWER($2)
                OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE LOWER($2))`,
        [tenantId, pattern],
      );
      requestorIds = users.map((u) => u.id);
      if (requestorIds.length === 0) {
        return { items: [], total: 0, page, limit };
      }
    }

    return this.runInTenantContext(
      tenantId,
      async (_configRepo, requestRepo, _stepRepo, em) => {
        const STATUS_PRIORITY: Record<string, number> = {
          [WorkflowRequestStatus.PENDING]: 1,
          [WorkflowRequestStatus.IN_REVIEW]: 2,
          [WorkflowRequestStatus.APPROVED]: 3,
          [WorkflowRequestStatus.REJECTED]: 4,
          [WorkflowRequestStatus.CANCELLED]: 5,
        };

        const buildPendingQb = () => {
          const qb = requestRepo
            .createQueryBuilder('wr')
            // Load ALL steps for display
            .leftJoinAndSelect('wr.steps', 'step')
            // Separate join used only for filtering — does not affect loaded steps
            .innerJoin(
              WorkflowStep,
              'currentStep',
              'currentStep.workflow_request_id = wr.id' +
                ' AND currentStep.step_order = wr.current_step_order' +
                ' AND currentStep.status = :stepStatus' +
                ' AND LOWER(currentStep.approver_role) = LOWER(:actorRole)',
              { stepStatus: WorkflowStepStatus.PENDING, actorRole },
            )
            .where('wr.tenant_id = :tenantId', { tenantId })
            .andWhere('wr.status IN (:...statuses)', {
              statuses: [
                WorkflowRequestStatus.PENDING,
                WorkflowRequestStatus.IN_REVIEW,
              ],
            })
            .orderBy('wr.created_at', 'DESC')
            .addOrderBy('step.step_order', 'ASC');
          if (requestType)
            qb.andWhere('wr.request_type = :requestType', { requestType });
          if (requestorIds)
            qb.andWhere('wr.requestor_id IN (:...requestorIds)', {
              requestorIds,
            });
          return qb;
        };

        const buildHistoryBaseQb = () => {
          const qb = requestRepo
            .createQueryBuilder('wr')
            .where('wr.tenant_id = :tenantId', { tenantId })
            .andWhere(
              (subQb) =>
                `EXISTS (${subQb
                  .subQuery()
                  .select('1')
                  .from(WorkflowStep, 'ws')
                  .where('ws.workflow_request_id = wr.id')
                  .andWhere('ws.approver_id = :actorId')
                  .getQuery()})`,
              { actorId },
            );
          if (requestType)
            qb.andWhere('wr.request_type = :requestType', { requestType });
          if (requestorIds)
            qb.andWhere('wr.requestor_id IN (:...requestorIds)', {
              requestorIds,
            });
          return qb;
        };

        const buildHistoryDataQb = () =>
          buildHistoryBaseQb()
            .leftJoinAndSelect('wr.steps', 'step')
            .orderBy('wr.updated_at', 'DESC')
            .addOrderBy('step.step_order', 'ASC');

        if (view === 'history') {
          const total = await buildHistoryBaseQb().getCount();
          const raw = await buildHistoryDataQb()
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();
          const enriched = await this.enrichWithEntityData(raw, tenantId, em);
          const items = await this.enrichWithWorkflowActors(enriched);
          return { items, total, page, limit };
        }

        if (view === 'all') {
          const [pendingItems, historyItems] = await Promise.all([
            buildPendingQb().getMany(),
            buildHistoryDataQb().getMany(),
          ]);

          // Pending takes precedence: insert history first then overwrite with pending
          const merged = new Map<string, WorkflowRequest>();
          for (const item of historyItems) merged.set(item.id, item);
          for (const item of pendingItems) merged.set(item.id, item);

          const sorted = Array.from(merged.values()).sort((a, b) => {
            const pa = STATUS_PRIORITY[a.status] ?? 99;
            const pb = STATUS_PRIORITY[b.status] ?? 99;
            if (pa !== pb) return pa - pb;
            return (
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime()
            );
          });

          const total = sorted.length;
          const sliced = sorted.slice((page - 1) * limit, page * limit);
          const enriched = await this.enrichWithEntityData(
            sliced,
            tenantId,
            em,
          );
          const items = await this.enrichWithWorkflowActors(enriched);
          return { items, total, page, limit };
        }

        // view === 'pending' (default)
        const qb = buildPendingQb();
        const total = await qb.getCount();
        const raw = await qb
          .skip((page - 1) * limit)
          .take(limit)
          .getMany();
        const enriched = await this.enrichWithEntityData(raw, tenantId, em);
        const items = await this.enrichWithWorkflowActors(enriched);
        return { items, total, page, limit };
      },
    );
  }

  async getWorkflowRequestById(
    workflowRequestId: string,
    tenantId: string,
  ): Promise<EnrichedRequest> {
    return this.runInTenantContext(
      tenantId,
      async (_configRepo, requestRepo, _stepRepo, em) => {
        const request = await requestRepo.findOne({
          where: { id: workflowRequestId, tenant_id: tenantId },
          relations: ['steps'],
          order: { steps: { step_order: 'ASC' } },
        });

        if (!request) {
          throw new NotFoundException('Workflow request not found');
        }

        const [withData] = await this.enrichWithEntityData(
          [request],
          tenantId,
          em,
        );
        const [enriched] = await this.enrichWithWorkflowActors([withData]);
        return enriched;
      },
    );
  }

  async getMyRequests(
    tenantId: string,
    requestorId: string,
    requestType?: WorkflowRequestType,
    status?: WorkflowRequestStatus,
    page = 1,
    limit = 20,
  ): Promise<{
    items: EnrichedRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.runInTenantContext(
      tenantId,
      async (_configRepo, requestRepo, _stepRepo, em) => {
        const applyFilters = (
          qb: ReturnType<typeof requestRepo.createQueryBuilder>,
        ) => {
          qb.where('wr.tenant_id = :tenantId', { tenantId }).andWhere(
            'wr.requestor_id = :requestorId',
            { requestorId },
          );
          if (requestType)
            qb.andWhere('wr.request_type = :requestType', { requestType });
          if (status) qb.andWhere('wr.status = :status', { status });
          return qb;
        };

        // Count on a join-free QB — avoids TypeORM counting each step row separately
        const total = await applyFilters(
          requestRepo.createQueryBuilder('wr'),
        ).getCount();

        const raw = await applyFilters(
          requestRepo
            .createQueryBuilder('wr')
            .leftJoinAndSelect('wr.steps', 'step')
            .orderBy('wr.created_at', 'DESC')
            .addOrderBy('step.step_order', 'ASC'),
        )
          .skip((page - 1) * limit)
          .take(limit)
          .getMany();

        const withData = await this.enrichWithEntityData(raw, tenantId, em);
        const items = await this.enrichWithWorkflowActors(withData);
        return { items, total, page, limit };
      },
    );
  }

  async getWorkflowDetailForEntity(
    relatedEntityId: string,
    tenantId: string,
  ): Promise<WorkflowSummary | null> {
    return this.runInTenantContext(
      tenantId,
      async (_configRepo, requestRepo) => {
        const request = await requestRepo.findOne({
          where: { related_entity_id: relatedEntityId, tenant_id: tenantId },
          relations: ['steps'],
          order: { created_at: 'DESC', steps: { step_order: 'ASC' } },
        });
        if (!request) return null;

        const userIds = new Set<string>();
        userIds.add(request.requestor_id);
        for (const step of request.steps ?? []) {
          if (step.approver_id) userIds.add(step.approver_id);
        }
        const nameMap = await this.buildWorkflowActorMap(Array.from(userIds));

        return {
          id: request.id,
          status: request.status,
          request_type: request.request_type,
          current_step_order: request.current_step_order,
          total_steps: request.total_steps,
          requestor: nameMap.get(request.requestor_id) ?? null,
          steps: this.truncateStepsAtRejection(
            (request.steps ?? []).map((step) => ({
              ...step,
              approver: step.approver_id
                ? (nameMap.get(step.approver_id) ?? null)
                : null,
            })),
          ),
        };
      },
    );
  }

  private async enrichWithEntityData(
    items: WorkflowRequest[],
    tenantId: string,
    em: EntityManager | null,
  ): Promise<
    Array<WorkflowRequest & { request_data: Record<string, unknown> | null }>
  > {
    if (items.length === 0) return [];

    const runQuery = (
      sql: string,
      params: unknown[],
    ): Promise<Record<string, unknown>[]> =>
      em ? em.query(sql, params) : this.dataSource.query(sql, params);

    const byType = new Map<string, string[]>();
    for (const item of items) {
      const arr = byType.get(item.request_type) ?? [];
      arr.push(item.related_entity_id);
      byType.set(item.request_type, arr);
    }

    const wfhIds = byType.get(WorkflowRequestType.WFH) ?? [];
    const overtimeIds = byType.get(WorkflowRequestType.OVERTIME) ?? [];
    const leaveIds = byType.get(WorkflowRequestType.LEAVE) ?? [];

    const [wfhRows, overtimeRows, leaveRows] = await Promise.all([
      wfhIds.length
        ? runQuery(
            `SELECT id, start_date, end_date, reason, status, attachments
               FROM wfh_requests
              WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
            [wfhIds, tenantId],
          )
        : Promise.resolve([]),
      overtimeIds.length
        ? runQuery(
            `SELECT id, start_date, end_date, hours, reason, status, attachments
               FROM overtime_requests
              WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
            [overtimeIds, tenantId],
          )
        : Promise.resolve([]),
      leaveIds.length
        ? runQuery(
            `SELECT id,
                    "startDate"   AS start_date,
                    "endDate"     AS end_date,
                    "totalDays"   AS total_days,
                    reason,
                    status,
                    documents     AS attachments,
                    "leaveTypeId" AS leave_type_id
               FROM leaves
              WHERE id = ANY($1::uuid[]) AND "tenantId" = $2`,
            [leaveIds, tenantId],
          )
        : Promise.resolve([]),
    ]);

    const entityMap = new Map<string, Record<string, unknown>>();
    for (const row of [...wfhRows, ...overtimeRows, ...leaveRows]) {
      entityMap.set(row['id'] as string, row);
    }

    return items.map((item) => ({
      ...item,
      request_data: entityMap.get(item.related_entity_id) ?? null,
    }));
  }

  private async buildWorkflowActorMap(
    userIds: string[],
  ): Promise<Map<string, WorkflowActor>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.dataSource.query<WorkflowActor[]>(
      `SELECT id, first_name, last_name FROM users WHERE id = ANY($1::uuid[])`,
      [userIds],
    );
    const map = new Map<string, WorkflowActor>();
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  private truncateStepsAtRejection<
    T extends { step_order: number; status: string },
  >(steps: T[]): T[] {
    const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
    const rejectedIdx = sorted.findIndex((s) => s.status === 'rejected');
    return rejectedIdx === -1 ? sorted : sorted.slice(0, rejectedIdx + 1);
  }

  private async enrichWithWorkflowActors(
    items: Array<
      WorkflowRequest & { request_data: Record<string, unknown> | null }
    >,
  ): Promise<EnrichedRequest[]> {
    if (items.length === 0) return [];
    const userIds = new Set<string>();
    for (const item of items) {
      userIds.add(item.requestor_id);
      for (const step of item.steps ?? []) {
        if (step.approver_id) userIds.add(step.approver_id);
      }
    }
    const nameMap = await this.buildWorkflowActorMap(Array.from(userIds));
    return items.map((item) => ({
      ...item,
      requestor: nameMap.get(item.requestor_id) ?? null,
      steps: this.truncateStepsAtRejection(
        (item.steps ?? []).map((step) => ({
          ...step,
          approver: step.approver_id
            ? (nameMap.get(step.approver_id) ?? null)
            : null,
        })),
      ),
    }));
  }

  async getWorkflowRequestByEntity(
    relatedEntityId: string,
    tenantId: string,
  ): Promise<WorkflowRequest | null> {
    return this.runInTenantContext(
      tenantId,
      async (_configRepo, requestRepo) => {
        return requestRepo.findOne({
          where: { related_entity_id: relatedEntityId, tenant_id: tenantId },
          relations: ['steps'],
          order: { created_at: 'DESC' },
        });
      },
    );
  }

  // ── Feature flag ──────────────────────────────────────────────────────────

  private requestTypeToKey(requestType: WorkflowRequestType): TenantSettingKey {
    switch (requestType) {
      case WorkflowRequestType.LEAVE:
        return TenantSettingKey.LEAVE_WORKFLOW_ENABLED;
      case WorkflowRequestType.WFH:
        return TenantSettingKey.WFH_WORKFLOW_ENABLED;
      case WorkflowRequestType.OVERTIME:
        return TenantSettingKey.OVERTIME_WORKFLOW_ENABLED;
      default:
        throw new BadRequestException(
          `Invalid request_type: ${String(requestType)}`,
        );
    }
  }

  async setWorkflowEnabled(
    tenantId: string,
    requestType: WorkflowRequestType,
    enabled: boolean,
  ): Promise<WorkflowSettingsResponse> {
    const key = this.requestTypeToKey(requestType);
    await this.tenantSettings.set(tenantId, key, String(enabled));
    this.logger.log(
      `Workflow ${enabled ? 'enabled' : 'disabled'} for ${requestType} on tenant ${tenantId}`,
    );
    return this.getWorkflowSettings(tenantId);
  }

  async getWorkflowSettings(
    tenantId: string,
  ): Promise<WorkflowSettingsResponse> {
    const [leave, wfh, overtime] = await Promise.all([
      this.tenantSettings.getBoolean(
        tenantId,
        TenantSettingKey.LEAVE_WORKFLOW_ENABLED,
      ),
      this.tenantSettings.getBoolean(
        tenantId,
        TenantSettingKey.WFH_WORKFLOW_ENABLED,
      ),
      this.tenantSettings.getBoolean(
        tenantId,
        TenantSettingKey.OVERTIME_WORKFLOW_ENABLED,
      ),
    ]);
    return {
      leave_workflow_enabled: leave,
      wfh_workflow_enabled: wfh,
      overtime_workflow_enabled: overtime,
    };
  }

  // ── Team schedule ─────────────────────────────────────────────────────────

  async getTeamSchedule(
    managerId: string,
    tenantId: string,
    week: string,
  ): Promise<{
    week: string;
    monday: string;
    sunday: string;
    wfh: Record<string, unknown>[];
    overtime: Record<string, unknown>[];
  }> {
    const { monday, sunday } = this.parseISOWeek(week);
    const mondayStr = monday.toISOString().slice(0, 10);
    const sundayStr = sunday.toISOString().slice(0, 10);

    const teamMemberRows = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT e.user_id
         FROM employees e
         JOIN teams t ON e.team_id = t.id
        WHERE t.manager_id = $1 AND e.tenant_id = $2`,
      [managerId, tenantId],
    );

    if (teamMemberRows.length === 0) {
      return {
        week,
        monday: mondayStr,
        sunday: sundayStr,
        wfh: [],
        overtime: [],
      };
    }

    const memberIds = teamMemberRows.map((r) => r.user_id);

    const [wfhRows, overtimeRows] = await Promise.all([
      this.dataSource.query<Record<string, unknown>[]>(
        `SELECT w.id, w.employee_id, w.start_date, w.end_date, w.reason, w.status,
                u.first_name, u.last_name
           FROM wfh_requests w
           JOIN public.users u ON u.id = w.employee_id
          WHERE w.tenant_id = $1
            AND w.status = 'approved'
            AND w.employee_id = ANY($2::uuid[])
            AND w.start_date <= $3
            AND w.end_date   >= $4`,
        [tenantId, memberIds, sundayStr, mondayStr],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        `SELECT o.id, o.employee_id, o.start_date, o.end_date, o.hours, o.reason, o.status,
                u.first_name, u.last_name
           FROM overtime_requests o
           JOIN public.users u ON u.id = o.employee_id
          WHERE o.tenant_id = $1
            AND o.status = 'approved'
            AND o.employee_id = ANY($2::uuid[])
            AND o.start_date <= $3
            AND o.end_date   >= $4`,
        [tenantId, memberIds, sundayStr, mondayStr],
      ),
    ]);

    return {
      week,
      monday: mondayStr,
      sunday: sundayStr,
      wfh: wfhRows,
      overtime: overtimeRows,
    };
  }

  private parseISOWeek(week: string): { monday: Date; sunday: Date } {
    const match = /^(\d{4})-W(\d{1,2})$/.exec(week);
    if (!match) {
      throw new BadRequestException(
        'Invalid week format. Use ISO 8601 week notation, e.g. "2025-W22"',
      );
    }
    const year = parseInt(match[1], 10);
    const weekNum = parseInt(match[2], 10);
    if (weekNum < 1 || weekNum > 53) {
      throw new BadRequestException('Week number must be between 1 and 53');
    }

    // Jan 4 is always in ISO week 1
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7; // treat Sunday (0) as 7
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1) + (weekNum - 1) * 7);

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return { monday, sunday };
  }

  // ── Audit ─────────────────────────────────────────────────────────────────

  private async writeAudit(
    workflowRequestId: string,
    tenantId: string,
    actorId: string,
    fromStatus: string,
    toStatus: string,
    note: string | null,
  ): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          workflow_request_id: workflowRequestId,
          tenant_id: tenantId,
          actor_id: actorId,
          from_status: fromStatus,
          to_status: toStatus,
          note,
        }),
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to write audit for workflow ${workflowRequestId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
