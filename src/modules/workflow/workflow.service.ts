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
import {
  WorkflowRequestType,
  WorkflowRequestStatus,
  WorkflowStepStatus,
} from '../../common/constants/enums';

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

export type EnrichedRequest = WorkflowRequest & {
  requestor: WorkflowActor | null;
  request_data: Record<string, unknown> | null;
  steps: EnrichedStep[];
};
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { UpsertWorkflowConfigDto } from './dto/upsert-workflow-config.dto';
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
    private readonly eventEmitter: EventEmitter2,
    private readonly tenantDbService: TenantDatabaseService,
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

  async upsertWorkflowConfig(
    tenantId: string,
    dto: UpsertWorkflowConfigDto,
  ): Promise<WorkflowConfig[]> {
    return this.runInTenantContext(tenantId, async (configRepo) => {
      const results: WorkflowConfig[] = [];
      for (const step of dto.steps) {
        const existing = await configRepo.findOne({
          where: {
            tenant_id: tenantId,
            request_type: dto.request_type,
            step_order: step.step_order,
          },
        });
        if (existing) {
          existing.approver_role = step.approver_role;
          existing.step_label = step.step_label;
          existing.is_active = step.is_active ?? existing.is_active;
          results.push(await configRepo.save(existing));
        } else {
          const created = configRepo.create({
            tenant_id: tenantId,
            request_type: dto.request_type,
            step_order: step.step_order,
            approver_role: step.approver_role,
            step_label: step.step_label,
            is_active: step.is_active ?? true,
          });
          results.push(await configRepo.save(created));
        }
      }
      return results.sort((a, b) => a.step_order - b.step_order);
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

        if (action === StepAction.REJECTED) {
          workflowRequest.status = WorkflowRequestStatus.REJECTED;
          await requestRepo.save(workflowRequest);
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
            this.eventEmitter.emit(WORKFLOW_EVENTS.REQUEST_APPROVED, event);
            this.logger.log(`Workflow ${workflowRequestId} fully approved`);
          } else {
            workflowRequest.current_step_order += 1;
            workflowRequest.status = WorkflowRequestStatus.IN_REVIEW;
            await requestRepo.save(workflowRequest);

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

        return requestRepo.findOne({
          where: { id: workflowRequestId },
          relations: ['steps'],
        }) as Promise<WorkflowRequest>;
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

        workflowRequest.status = WorkflowRequestStatus.CANCELLED;
        await requestRepo.save(workflowRequest);

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
  ): Promise<{
    items: EnrichedRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
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
            .innerJoinAndSelect('wr.steps', 'step')
            .where('wr.tenant_id = :tenantId', { tenantId })
            .andWhere('wr.status IN (:...statuses)', {
              statuses: [
                WorkflowRequestStatus.PENDING,
                WorkflowRequestStatus.IN_REVIEW,
              ],
            })
            .andWhere('step.step_order = wr.current_step_order')
            .andWhere('step.status = :stepStatus', {
              stepStatus: WorkflowStepStatus.PENDING,
            })
            .andWhere('LOWER(step.approver_role) = LOWER(:actorRole)', {
              actorRole,
            })
            .orderBy('wr.created_at', 'DESC');
          if (requestType)
            qb.andWhere('wr.request_type = :requestType', { requestType });
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
          steps: (request.steps ?? []).map((step) => ({
            ...step,
            approver: step.approver_id
              ? (nameMap.get(step.approver_id) ?? null)
              : null,
          })),
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
      steps: (item.steps ?? []).map((step) => ({
        ...step,
        approver: step.approver_id
          ? (nameMap.get(step.approver_id) ?? null)
          : null,
      })),
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

  async setWorkflowEnabled(
    tenantId: string,
    enabled: boolean,
  ): Promise<{ workflow_enabled: boolean }> {
    await this.dataSource.query(
      `UPDATE public.tenants SET workflow_enabled = $1, updated_at = NOW() WHERE id = $2`,
      [enabled, tenantId],
    );
    this.logger.log(
      `Workflow engine ${enabled ? 'enabled' : 'disabled'} for tenant ${tenantId}`,
    );
    return { workflow_enabled: enabled };
  }

  async getWorkflowEnabled(
    tenantId: string,
  ): Promise<{ workflow_enabled: boolean }> {
    const result = await this.dataSource.query<{ workflow_enabled: boolean }[]>(
      `SELECT workflow_enabled FROM public.tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    return { workflow_enabled: result[0]?.workflow_enabled ?? false };
  }
}
