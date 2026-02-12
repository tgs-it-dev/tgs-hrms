import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Announcement } from '../../entities/announcement.entity';
import { User } from '../../entities/user.entity';
import { EmailService, EmailTemplateService } from '../../common/utils/email';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import {
  AnnouncementStatus,
  AnnouncementCategory,
  AnnouncementPriority,
} from '../../common/constants/enums';

@Injectable()
export class AnnouncementService {
  private readonly logger = new Logger(AnnouncementService.name);

  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  /**
   * Create a new announcement
   * If send_now is true, sends immediately; otherwise saves as draft
   */
  async create(
    tenant_id: string | null,
    created_by: string,
    dto: CreateAnnouncementDto,
  ): Promise<Announcement> {
    if (tenant_id == null || tenant_id === '') throw new BadRequestException('Tenant context is required');
    const status = dto.send_now
      ? AnnouncementStatus.SENT
      : dto.scheduled_at
        ? AnnouncementStatus.SCHEDULED
        : AnnouncementStatus.DRAFT;

    const announcement = this.announcementRepo.create({
      tenant_id,
      created_by,
      title: dto.title,
      content: dto.content,
      category: dto.category || AnnouncementCategory.GENERAL,
      priority: dto.priority || AnnouncementPriority.MEDIUM,
      status,
      scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : null,
    });

    const saved = await this.announcementRepo.save(announcement);

    // Send immediately if requested
    if (dto.send_now) {
      await this.sendAnnouncementToTenant(tenant_id, saved);
    }

    return this.findOne(tenant_id, saved.id);
  }

  /**
   * Get all announcements for a tenant (paginated)
   */
  async findAll(tenant_id: string | null, page = 1) {
    if (tenant_id == null || tenant_id === '') throw new BadRequestException('Tenant context is required');
    const limit = 25;
    const skip = (page - 1) * limit;

    const [items, total] = await this.announcementRepo.findAndCount({
      where: { tenant_id },
      relations: ['creator'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    // Map to safe response (exclude sensitive creator data)
    const safeItems = items.map((item) => ({
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

    return {
      items: safeItems,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single announcement by ID
   */
  async findOne(tenant_id: string | null, id: string): Promise<Announcement> {
    if (tenant_id == null || tenant_id === '') throw new BadRequestException('Tenant context is required');
    const announcement = await this.announcementRepo.findOne({
      where: { id, tenant_id },
      relations: ['creator'],
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found.');
    }

    return announcement;
  }

  /**
   * Update an announcement (only if not sent)
   */
  async update(
    tenant_id: string | null,
    id: string,
    dto: UpdateAnnouncementDto,
  ): Promise<Announcement> {
    if (tenant_id == null || tenant_id === '') throw new BadRequestException('Tenant context is required');
    const announcement = await this.findOne(tenant_id, id);

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new BadRequestException(
        'Cannot update an announcement that has already been sent.',
      );
    }

    // Update fields
    if (dto.title !== undefined) announcement.title = dto.title;
    if (dto.content !== undefined) announcement.content = dto.content;
    if (dto.category !== undefined) announcement.category = dto.category;
    if (dto.priority !== undefined) announcement.priority = dto.priority;

    // Handle scheduled_at
    if (dto.scheduled_at !== undefined) {
      announcement.scheduled_at = dto.scheduled_at
        ? new Date(dto.scheduled_at)
        : null;
      announcement.status = dto.scheduled_at
        ? AnnouncementStatus.SCHEDULED
        : AnnouncementStatus.DRAFT;
    }

    await this.announcementRepo.save(announcement);
    return this.findOne(tenant_id, id);
  }

  /**
   * Soft delete an announcement
   */
  async softDelete(
    tenant_id: string | null,
    id: string,
  ): Promise<{ deleted: boolean; id: string }> {
    if (tenant_id == null || tenant_id === '') throw new BadRequestException('Tenant context is required');
    const announcement = await this.findOne(tenant_id, id);
    await this.announcementRepo.softDelete({ id: announcement.id, tenant_id });
    return { deleted: true, id };
  }

  /**
   * Send/publish a draft announcement immediately
   */
  async send(tenant_id: string | null, id: string): Promise<Announcement> {
    if (tenant_id == null || tenant_id === '') throw new BadRequestException('Tenant context is required');
    const announcement = await this.findOne(tenant_id, id);

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new BadRequestException('Announcement has already been sent.');
    }

    if (announcement.status === AnnouncementStatus.CANCELLED) {
      throw new BadRequestException('Cannot send a cancelled announcement.');
    }

    await this.sendAnnouncementToTenant(tenant_id, announcement);
    return this.findOne(tenant_id, id);
  }

  /**
   * Cancel a scheduled announcement
   */
  async cancel(tenant_id: string | null, id: string): Promise<Announcement> {
    if (tenant_id == null || tenant_id === '') throw new BadRequestException('Tenant context is required');
    const announcement = await this.findOne(tenant_id, id);

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new BadRequestException(
        'Cannot cancel an announcement that has already been sent.',
      );
    }

    announcement.status = AnnouncementStatus.CANCELLED;
    announcement.scheduled_at = null;
    await this.announcementRepo.save(announcement);

    return this.findOne(tenant_id, id);
  }

  /**
   * Build and send a single announcement email using the common EmailService.
   */
  private async sendAnnouncementEmail(
    recipientEmail: string,
    recipientName: string,
    title: string,
    content: string,
    category: string,
    priority: string,
  ): Promise<void> {
    const from = this.emailService.getFromEmail();
    if (!from) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping announcement email.');
      return;
    }
    const priorityStyles: Record<string, { color: string; badge: string }> = {
      low: { color: '#28a745', badge: 'Low Priority' },
      medium: { color: '#ffc107', badge: 'Medium Priority' },
      high: { color: '#dc3545', badge: 'High Priority' },
    };
    const categoryLabels: Record<string, string> = {
      general: 'General Announcement',
      holiday: 'Holiday Notice',
      policy: 'Policy Update',
      event: 'Event Announcement',
      urgent: 'Urgent Notice',
    };
    const style = priorityStyles[priority] ?? priorityStyles.medium;
    const categoryLabel = categoryLabels[category] ?? 'Announcement';
    const contentHtml = content.replace(/\n/g, '<br>');
    const html = this.emailTemplateService.render('announcement', {
      recipientName,
      title,
      contentHtml,
      categoryLabel,
      styleColor: style.color,
      styleBadge: style.badge,
    });
    const subject = `${priority === 'high' ? '🔴 ' : ''}${categoryLabel}: ${title}`;
    await this.emailService.send({ to: recipientEmail, from, subject, html });
  }

  /**
   * Send announcement email to all users in the tenant
   */
  private async sendAnnouncementToTenant(
    tenant_id: string,
    announcement: Announcement,
  ): Promise<void> {
    try {
      // Get all users in this tenant
      const tenantUsers = await this.userRepo.find({
        where: { tenant_id },
        select: ['id', 'email', 'first_name', 'last_name'],
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
          await this.sendAnnouncementEmail(
            user.email,
            `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Team Member',
            announcement.title,
            announcement.content,
            announcement.category,
            announcement.priority,
          );
          sentCount++;
        } catch (emailError) {
          this.logger.error(
            `Failed to send announcement to ${user.email}: ${
              emailError instanceof Error ? emailError.message : String(emailError)
            }`,
          );
          // Continue with other recipients
        }
      }

      // Update announcement status
      announcement.status = AnnouncementStatus.SENT;
      announcement.sent_at = new Date();
      announcement.recipient_count = sentCount;
      await this.announcementRepo.save(announcement);

      this.logger.log(
        `Announcement "${announcement.title}" sent to ${sentCount}/${tenantUsers.length} users (tenant: ${tenant_id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send announcement to tenant ${tenant_id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException('Failed to send announcement emails.');
    }
  }

  /**
   * Cron job: Process scheduled announcements
   * Runs every minute to check for announcements that should be sent
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledAnnouncements(): Promise<void> {
    const now = new Date();

    const scheduledAnnouncements = await this.announcementRepo.find({
      where: {
        status: AnnouncementStatus.SCHEDULED,
        scheduled_at: LessThanOrEqual(now),
      },
    });

    if (scheduledAnnouncements.length === 0) {
      return;
    }

    this.logger.log(
      `Processing ${scheduledAnnouncements.length} scheduled announcement(s)...`,
    );

    for (const announcement of scheduledAnnouncements) {
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
  }

  /**
   * Get announcement statistics for dashboard
   */
  async getStats(tenant_id: string | null): Promise<{
    total: number;
    drafts: number;
    scheduled: number;
    sent: number;
  }> {
    if (tenant_id == null || tenant_id === '') throw new BadRequestException('Tenant context is required');
    const qb = this.announcementRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenant_id', { tenant_id })
      .andWhere('a.deleted_at IS NULL');

    const [total, drafts, scheduled, sent] = await Promise.all([
      qb.clone().getCount(),
      qb.clone().andWhere('a.status = :status', { status: AnnouncementStatus.DRAFT }).getCount(),
      qb.clone().andWhere('a.status = :status', { status: AnnouncementStatus.SCHEDULED }).getCount(),
      qb.clone().andWhere('a.status = :status', { status: AnnouncementStatus.SENT }).getCount(),
    ]);

    return { total, drafts, scheduled, sent };
  }
}
