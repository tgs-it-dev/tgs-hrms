import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, LessThanOrEqual, Repository } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Announcement } from "../../entities/announcement.entity";
import { User } from "../../entities/user.entity";
import { SendGridService } from "../../common/utils/email";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { UpdateAnnouncementDto } from "./dto/update-announcement.dto";
import {
  AnnouncementStatus,
  AnnouncementCategory,
  AnnouncementPriority,
  GLOBAL_SYSTEM_TENANT_ID,
} from "../../common/constants/enums";
import { TenantDatabaseService } from "../../common/services/tenant-database.service";

@Injectable()
export class AnnouncementService {
  private readonly logger = new Logger(AnnouncementService.name);

  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly sendGridService: SendGridService,
    private readonly tenantDbService: TenantDatabaseService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

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
    work: (repo: Repository<Announcement>) => Promise<T>,
  ): Promise<T> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        work(em.getRepository(Announcement)),
      );
    }
    return work(this.announcementRepo);
  }

  private mapSafeAnnouncementList(items: Announcement[]) {
    return items.map((item) => ({
      ...item,
      creator: item.creator
        ? {
            id: item.creator.id,
            first_name: item.creator.first_name,
            last_name: item.creator.last_name,
            email: item.creator.email,
          }
        : null,
    }));
  }

  /**
   * Create a new announcement
   * If send_now is true, sends immediately; otherwise saves as draft
   */
  async create(
    tenant_id: string,
    created_by: string,
    dto: CreateAnnouncementDto,
  ): Promise<Announcement> {
    const status = dto.send_now
      ? AnnouncementStatus.SENT
      : dto.scheduled_at
        ? AnnouncementStatus.SCHEDULED
        : AnnouncementStatus.DRAFT;

    return this.runInTenantContext(tenant_id, async (repo) => {
      const announcement = repo.create({
        tenant_id,
        created_by,
        title: dto.title,
        content: dto.content,
        category: dto.category || AnnouncementCategory.GENERAL,
        priority: dto.priority || AnnouncementPriority.MEDIUM,
        status,
        scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : null,
      });

      const saved = await repo.save(announcement);

      if (dto.send_now) {
        await this.sendAnnouncementToTenant(tenant_id, saved, repo);
      }

      const full = await repo.findOne({
        where: { id: saved.id, tenant_id },
        relations: ["creator"],
      });
      if (!full) {
        throw new NotFoundException("Announcement not found.");
      }
      return full;
    });
  }

  /**
   * Get all announcements for a tenant (paginated).
   * System/global tenant: merges legacy public rows with per-tenant-schema rows.
   */
  async findAll(tenant_id: string, page = 1) {
    const limit = 25;
    const skip = (page - 1) * limit;

    if (tenant_id === GLOBAL_SYSTEM_TENANT_ID) {
      return this.findAllGlobalMerged(page, limit, skip);
    }

    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    const fetch = (repo: Repository<Announcement>) =>
      repo.findAndCount({
        where: { tenant_id },
        relations: ["creator"],
        order: { created_at: "DESC" },
        skip,
        take: limit,
      });

    const [items, total] = isProvisioned
      ? await this.tenantDbService.withTenantSchemaReadOnly(tenant_id, (em) =>
          fetch(em.getRepository(Announcement)),
        )
      : await fetch(this.announcementRepo);

    return {
      items: this.mapSafeAnnouncementList(items),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async findAllGlobalMerged(page: number, limit: number, skip: number) {
    const legacyTenantRows = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM public.tenants WHERE schema_provisioned IS NOT TRUE`,
    );
    const legacyTenantIds = legacyTenantRows.map((r) => r.id);

    let legacyItems: Announcement[] = [];
    if (legacyTenantIds.length > 0) {
      legacyItems = await this.announcementRepo.find({
        where: { tenant_id: In(legacyTenantIds) },
        relations: ["creator"],
        order: { created_at: "DESC" },
      });
    }

    const provRows = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    );

    const fromSchemas: Announcement[][] = await Promise.all(
      provRows.map(({ id }) =>
        this.tenantDbService.withTenantSchemaReadOnly(id, (em) =>
          em.getRepository(Announcement).find({
            relations: ["creator"],
            order: { created_at: "DESC" },
          }),
        ),
      ),
    );

    const merged = [...legacyItems, ...fromSchemas.flat()].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const total = merged.length;
    const pageSlice = merged.slice(skip, skip + limit);

    return {
      items: this.mapSafeAnnouncementList(pageSlice),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get single announcement by ID
   */
  async findOne(tenant_id: string, id: string): Promise<Announcement> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    const fetch = (repo: Repository<Announcement>) =>
      repo.findOne({
        where: { id, tenant_id },
        relations: ["creator"],
      });

    const announcement = isProvisioned
      ? await this.tenantDbService.withTenantSchemaReadOnly(tenant_id, (em) =>
          fetch(em.getRepository(Announcement)),
        )
      : await fetch(this.announcementRepo);

    if (!announcement) {
      throw new NotFoundException("Announcement not found.");
    }

    return announcement;
  }

  /**
   * Update an announcement (only if not sent)
   */
  async update(
    tenant_id: string,
    id: string,
    dto: UpdateAnnouncementDto,
  ): Promise<Announcement> {
    return this.runInTenantContext(tenant_id, async (repo) => {
      const announcement = await repo.findOne({
        where: { id, tenant_id },
        relations: ["creator"],
      });

      if (!announcement) {
        throw new NotFoundException("Announcement not found.");
      }

      if (announcement.status === AnnouncementStatus.SENT) {
        throw new BadRequestException(
          "Cannot update an announcement that has already been sent.",
        );
      }

      if (dto.title !== undefined) announcement.title = dto.title;
      if (dto.content !== undefined) announcement.content = dto.content;
      if (dto.category !== undefined) announcement.category = dto.category;
      if (dto.priority !== undefined) announcement.priority = dto.priority;

      if (dto.scheduled_at !== undefined) {
        announcement.scheduled_at = dto.scheduled_at
          ? new Date(dto.scheduled_at)
          : null;
        announcement.status = dto.scheduled_at
          ? AnnouncementStatus.SCHEDULED
          : AnnouncementStatus.DRAFT;
      }

      await repo.save(announcement);
      const full = await repo.findOne({
        where: { id, tenant_id },
        relations: ["creator"],
      });
      if (!full) {
        throw new NotFoundException("Announcement not found.");
      }
      return full;
    });
  }

  /**
   * Soft delete an announcement
   */
  async softDelete(
    tenant_id: string,
    id: string,
  ): Promise<{ deleted: boolean; id: string }> {
    return this.runInTenantContext(tenant_id, async (repo) => {
      const announcement = await repo.findOne({
        where: { id, tenant_id },
      });
      if (!announcement) {
        throw new NotFoundException("Announcement not found.");
      }
      await repo.softDelete({ id: announcement.id, tenant_id });
      return { deleted: true, id };
    });
  }

  /**
   * Send/publish a draft announcement immediately
   */
  async send(tenant_id: string, id: string): Promise<Announcement> {
    return this.runInTenantContext(tenant_id, async (repo) => {
      const announcement = await repo.findOne({
        where: { id, tenant_id },
        relations: ["creator"],
      });

      if (!announcement) {
        throw new NotFoundException("Announcement not found.");
      }

      if (announcement.status === AnnouncementStatus.SENT) {
        throw new BadRequestException("Announcement has already been sent.");
      }

      if (announcement.status === AnnouncementStatus.CANCELLED) {
        throw new BadRequestException("Cannot send a cancelled announcement.");
      }

      await this.sendAnnouncementToTenant(tenant_id, announcement, repo);

      const full = await repo.findOne({
        where: { id, tenant_id },
        relations: ["creator"],
      });
      if (!full) {
        throw new NotFoundException("Announcement not found.");
      }
      return full;
    });
  }

  /**
   * Cancel a scheduled announcement
   */
  async cancel(tenant_id: string, id: string): Promise<Announcement> {
    return this.runInTenantContext(tenant_id, async (repo) => {
      const announcement = await repo.findOne({
        where: { id, tenant_id },
        relations: ["creator"],
      });

      if (!announcement) {
        throw new NotFoundException("Announcement not found.");
      }

      if (announcement.status === AnnouncementStatus.SENT) {
        throw new BadRequestException(
          "Cannot cancel an announcement that has already been sent.",
        );
      }

      announcement.status = AnnouncementStatus.CANCELLED;
      announcement.scheduled_at = null;
      await repo.save(announcement);

      const full = await repo.findOne({
        where: { id, tenant_id },
        relations: ["creator"],
      });
      if (!full) {
        throw new NotFoundException("Announcement not found.");
      }
      return full;
    });
  }

  /**
   * Send announcement email to all users in the tenant
   */
  private async sendAnnouncementToTenant(
    tenant_id: string,
    announcement: Announcement,
    annRepo?: Repository<Announcement>,
  ): Promise<void> {
    const persist = async (ann: Announcement) => {
      if (annRepo) {
        await annRepo.save(ann);
      } else {
        await this.runInTenantContext(tenant_id, (repo) => repo.save(ann));
      }
    };

    try {
      const tenantUsers = await this.userRepo.find({
        where: { tenant_id },
        select: ["id", "email", "first_name", "last_name"],
        relations: ["tenant"],
      });

      if (tenantUsers.length === 0) {
        this.logger.warn(
          `No users found for tenant ${tenant_id}. Skipping announcement email.`,
        );
        return;
      }

      let sentCount = 0;

      for (const user of tenantUsers) {
        try {
          await this.sendGridService.sendAnnouncementEmail(
            user.email,
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              "Team Member",
            announcement.title,
            announcement.content,
            announcement.category,
            announcement.priority,
            user.tenant?.name || "Your Company",
          );
          sentCount++;
        } catch (emailError) {
          this.logger.error(
            `Failed to send announcement to ${user.email}: ${
              emailError instanceof Error
                ? emailError.message
                : String(emailError)
            }`,
          );
        }
      }

      announcement.status = AnnouncementStatus.SENT;
      announcement.sent_at = new Date();
      announcement.recipient_count = sentCount;
      await persist(announcement);

      this.logger.log(
        `Announcement "${announcement.title}" sent to ${sentCount}/${tenantUsers.length} users (tenant: ${tenant_id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send announcement to tenant ${tenant_id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException("Failed to send announcement emails.");
    }
  }

  /**
   * Cron job: Process scheduled announcements
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledAnnouncements(): Promise<void> {
    const now = new Date();

    const legacyTenantRows = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM public.tenants WHERE schema_provisioned IS NOT TRUE`,
    );
    const legacyTenantIds = legacyTenantRows.map((r) => r.id);

    let legacyScheduled: Announcement[] = [];
    if (legacyTenantIds.length > 0) {
      legacyScheduled = await this.announcementRepo.find({
        where: {
          status: AnnouncementStatus.SCHEDULED,
          scheduled_at: LessThanOrEqual(now),
          tenant_id: In(legacyTenantIds),
        },
      });
    }

    for (const announcement of legacyScheduled) {
      try {
        await this.sendAnnouncementToTenant(
          announcement.tenant_id,
          announcement,
        );
        this.logger.log(
          `Scheduled announcement "${announcement.title}" sent successfully.`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process scheduled announcement ${announcement.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const provRows = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    );

    for (const { id: tenantId } of provRows) {
      try {
        await this.tenantDbService.withTenantSchema(tenantId, async (em) => {
          const repo = em.getRepository(Announcement);
          const scheduled = await repo.find({
            where: {
              status: AnnouncementStatus.SCHEDULED,
              scheduled_at: LessThanOrEqual(now),
            },
          });

          for (const announcement of scheduled) {
            try {
              await this.sendAnnouncementToTenant(tenantId, announcement, repo);
              this.logger.log(
                `Scheduled announcement "${announcement.title}" sent successfully.`,
              );
            } catch (error) {
              this.logger.error(
                `Failed to process scheduled announcement ${announcement.id}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
          }
        });
      } catch (error) {
        this.logger.error(
          `Scheduled announcements scan failed for tenant ${tenantId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /**
   * Get announcement statistics for dashboard
   */
  async getStats(tenant_id: string): Promise<{
    total: number;
    drafts: number;
    scheduled: number;
    sent: number;
  }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);

    const runStats = (repo: Repository<Announcement>) => {
      const qb = repo
        .createQueryBuilder("a")
        .where("a.tenant_id = :tenant_id", { tenant_id })
        .andWhere("a.deleted_at IS NULL");

      return Promise.all([
        qb.clone().getCount(),
        qb
          .clone()
          .andWhere("a.status = :status", {
            status: AnnouncementStatus.DRAFT,
          })
          .getCount(),
        qb
          .clone()
          .andWhere("a.status = :status", {
            status: AnnouncementStatus.SCHEDULED,
          })
          .getCount(),
        qb
          .clone()
          .andWhere("a.status = :status", { status: AnnouncementStatus.SENT })
          .getCount(),
      ]);
    };

    const [total, drafts, scheduled, sent] = isProvisioned
      ? await this.tenantDbService.withTenantSchemaReadOnly(tenant_id, (em) =>
          runStats(em.getRepository(Announcement)),
        )
      : await runStats(this.announcementRepo);

    return { total, drafts, scheduled, sent };
  }
}
