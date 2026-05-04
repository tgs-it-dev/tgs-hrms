import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  EMAIL_TRANSACTIONAL_QUEUE,
  EMAIL_BULK_QUEUE,
  TRANSACTIONAL_JOB_OPTIONS,
  BULK_JOB_OPTIONS,
} from './constants/email-queue.constants';
import {
  EmailJobType,
  EmailPriority,
  EmailJob,
} from './interfaces/email-job.interface';
import { EmailThrottleService } from './email-throttle.service';
import { NewTeamMemberAnnouncementPayload } from './sendgrid.service';

/**
 * EmailService is the producer — the only entry point for the rest of the app.
 * It never touches SMTP/SendGrid directly; it enqueues BullMQ jobs and returns.
 *
 * All existing callers keep the same method signatures.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue(EMAIL_TRANSACTIONAL_QUEUE)
    private readonly transactionalQueue: Queue,
    @InjectQueue(EMAIL_BULK_QUEUE)
    private readonly bulkQueue: Queue,
    private readonly throttle: EmailThrottleService,
    private readonly configService: ConfigService,
  ) {}

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName: string,
    companyName: string,
    userId?: string,
  ): Promise<void> {
    await this.enqueueTransactional(
      {
        type: EmailJobType.PASSWORD_RESET,
        email,
        resetToken,
        userName,
        companyName,
        userId,
      },
      EmailPriority.HIGH,
      userId,
    );
  }

  async sendPasswordResetSuccessEmail(
    email: string,
    userName: string,
    companyName: string,
    userId?: string,
  ): Promise<void> {
    await this.enqueueTransactional(
      {
        type: EmailJobType.PASSWORD_RESET_SUCCESS,
        email,
        userName,
        companyName,
        userId,
      },
      EmailPriority.HIGH,
      userId,
    );
  }

  async sendWelcomeEmail(
    email: string,
    resetToken: string,
    userName: string,
    companyName: string,
    userId?: string,
  ): Promise<void> {
    await this.enqueueTransactional(
      {
        type: EmailJobType.WELCOME,
        email,
        resetToken,
        userName,
        companyName,
        userId,
      },
      EmailPriority.HIGH,
      userId,
    );
  }

  async sendNotificationEmail(
    email: string,
    title: string,
    message: string,
    userId?: string,
  ): Promise<void> {
    await this.enqueueTransactional(
      { type: EmailJobType.NOTIFICATION, email, title, message, userId },
      EmailPriority.MEDIUM,
      userId,
    );
  }

  async sendInvitationEmail(
    email: string,
    userName: string,
    companyName: string,
    inviteToken: string,
    userId?: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', '');
    const inviteUrl = `${frontendUrl}/accept-invitation?token=${inviteToken}`;
    const html = this.buildInvitationHtml(userName, companyName, inviteUrl);

    await this.enqueueTransactional(
      // inviteToken field is repurposed to carry pre-rendered HTML for the processor
      {
        type: EmailJobType.INVITATION,
        email,
        userName,
        companyName,
        inviteToken: html,
        userId,
      },
      EmailPriority.MEDIUM,
      userId,
    );
  }

  async sendReminderEmail(
    email: string,
    title: string,
    message: string,
    actionUrl?: string,
    userId?: string,
  ): Promise<void> {
    const html = this.buildReminderHtml(title, message, actionUrl);
    await this.enqueueTransactional(
      { type: EmailJobType.REMINDER, email, title, message: html, userId },
      EmailPriority.MEDIUM,
      userId,
    );
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    from?: string,
    userId?: string,
  ): Promise<void> {
    await this.enqueueTransactional(
      { type: EmailJobType.GENERIC, to, subject, html, from, userId },
      EmailPriority.MEDIUM,
      userId,
    );
  }

  async sendBulkEmail(
    emails: string[],
    subject: string,
    html: string,
    from?: string,
  ): Promise<void> {
    await this.enqueueBulk({
      type: EmailJobType.BULK,
      emails,
      subject,
      html,
      from,
    });
  }

  async sendNewTeamMemberAnnouncementEmail(
    payload: NewTeamMemberAnnouncementPayload,
  ): Promise<void> {
    await this.enqueueBulk({ type: EmailJobType.NEW_TEAM_MEMBER, payload });
  }

  async sendAnnouncementEmail(
    recipientEmail: string,
    recipientName: string,
    title: string,
    content: string,
    category: string,
    priority: string,
    companyName: string,
    userId?: string,
  ): Promise<void> {
    await this.enqueueBulk({
      type: EmailJobType.ANNOUNCEMENT,
      recipientEmail,
      recipientName,
      title,
      content,
      category,
      priority,
      companyName,
      userId,
    });
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async enqueueTransactional(
    data: EmailJob,
    priority: EmailPriority,
    userId?: string,
  ): Promise<void> {
    await this.checkThrottle(userId, data.type);

    const jobName = data.type;
    await this.transactionalQueue.add(jobName, data, {
      ...TRANSACTIONAL_JOB_OPTIONS,
      priority,
    });

    this.logger.debug(
      `Enqueued transactional job type=${data.type} userId=${userId ?? 'system'}`,
    );
  }

  private async enqueueBulk(data: EmailJob): Promise<void> {
    const jobName = data.type;
    await this.bulkQueue.add(jobName, data, BULK_JOB_OPTIONS);
    this.logger.debug(`Enqueued bulk job type=${data.type}`);
  }

  private async checkThrottle(
    userId: string | undefined,
    jobType: EmailJobType,
  ): Promise<void> {
    const { allowed, retryAfterMs } = await this.throttle.isAllowed(
      userId,
      jobType,
    );
    if (!allowed) {
      const retryAfterSec = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 60;
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Email rate limit exceeded for action "${jobType}". Retry after ${retryAfterSec}s.`,
          retryAfter: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private buildInvitationHtml(
    userName: string,
    companyName: string,
    inviteUrl: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>You're invited to join ${companyName}!</h2>
        <p>Hello ${userName},</p>
        <p>You have been invited to join ${companyName} on our HRMS platform.</p>
        <div style="text-align:center;margin:30px 0">
          <a href="${inviteUrl}"
             style="background-color:#007bff;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">
            Accept Invitation
          </a>
        </div>
        <p style="word-break:break-all;color:#666">${inviteUrl}</p>
        <p>This invitation expires in 7 days.</p>
      </div>`;
  }

  private buildReminderHtml(
    title: string,
    message: string,
    actionUrl?: string,
  ): string {
    let html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>Reminder: ${title}</h2>
        <p>${message}</p>`;
    if (actionUrl) {
      html += `
        <div style="text-align:center;margin:30px 0">
          <a href="${actionUrl}"
             style="background-color:#ffc107;color:black;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">
            Take Action
          </a>
        </div>`;
    }
    html += `</div>`;
    return html;
  }
}
