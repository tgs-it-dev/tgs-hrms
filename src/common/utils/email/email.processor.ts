import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  EMAIL_TRANSACTIONAL_QUEUE,
  EMAIL_BULK_QUEUE,
} from './constants/email-queue.constants';
import { EmailJob, EmailJobType } from './interfaces/email-job.interface';
import {
  IEmailProvider,
  EMAIL_PROVIDER,
} from './interfaces/email-provider.interface';

/**
 * Processes jobs from the transactional email queue.
 * One worker class per queue keeps concurrency and error handling isolated.
 */
@Processor(EMAIL_TRANSACTIONAL_QUEUE, {
  concurrency: 5,
})
export class TransactionalEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionalEmailProcessor.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
  ) {
    super();
  }

  async process(job: Job<EmailJob>): Promise<void> {
    this.logger.debug(
      `Processing job id=${job.id} type=${job.data.type} attempt=${job.attemptsMade + 1}`,
    );
    await this.dispatch(job.data);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailJob>): void {
    this.logger.log(`Job completed id=${job.id} type=${job.data.type}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJob>, error: Error): void {
    const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinal) {
      this.logger.error(
        `Job permanently failed id=${job.id} type=${job.data.type} — moved to dead-letter`,
        error.stack,
      );
    } else {
      this.logger.warn(
        `Job failed (will retry) id=${job.id} type=${job.data.type} attempt=${job.attemptsMade}: ${error.message}`,
      );
    }
  }

  private async dispatch(data: EmailJob): Promise<void> {
    switch (data.type) {
      case EmailJobType.PASSWORD_RESET:
        await this.emailProvider.sendPasswordResetEmail(
          data.email,
          data.resetToken,
          data.userName,
          data.companyName,
        );
        break;

      case EmailJobType.PASSWORD_RESET_SUCCESS:
        await this.emailProvider.sendPasswordResetSuccessEmail(
          data.email,
          data.userName,
          data.companyName,
        );
        break;

      case EmailJobType.WELCOME:
        await this.emailProvider.sendWelcomeEmail(
          data.email,
          data.resetToken,
          data.userName,
          data.companyName,
        );
        break;

      case EmailJobType.NOTIFICATION:
        await this.emailProvider.sendEmail(
          data.email,
          `Notification: ${data.title}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>${data.title}</h2><p>${data.message}</p></div>`,
        );
        break;

      case EmailJobType.INVITATION:
        // Invitation HTML is built by producer; here we just delegate.
        await this.emailProvider.sendEmail(
          data.email,
          `Invitation to join ${data.companyName}`,
          data.inviteToken, // producer pre-renders HTML into this field at enqueue time
        );
        break;

      case EmailJobType.REMINDER:
        await this.emailProvider.sendEmail(
          data.email,
          `Reminder: ${data.title}`,
          data.message,
        );
        break;

      case EmailJobType.GENERIC:
        await this.emailProvider.sendEmail(
          data.to,
          data.subject,
          data.html,
          data.from,
        );
        break;

      case EmailJobType.NEW_TEAM_MEMBER:
        await this.emailProvider.sendNewTeamMemberAnnouncementEmail(
          data.payload,
        );
        break;

      default:
        this.logger.warn(`Unknown email job type: ${(data as EmailJob).type}`);
    }
  }
}

/**
 * Processes jobs from the bulk email queue.
 * Lower concurrency — bulk sends are intentionally throttled at the queue level.
 */
@Processor(EMAIL_BULK_QUEUE, {
  concurrency: 2,
})
export class BulkEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkEmailProcessor.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
  ) {
    super();
  }

  async process(job: Job<EmailJob>): Promise<void> {
    this.logger.debug(`Processing bulk job id=${job.id} type=${job.data.type}`);

    if (job.data.type === EmailJobType.BULK) {
      await this.emailProvider.sendBulkEmail(
        job.data.emails,
        job.data.subject,
        job.data.html,
        job.data.from,
      );
      return;
    }

    if (job.data.type === EmailJobType.ANNOUNCEMENT) {
      await this.emailProvider.sendAnnouncementEmail(
        job.data.recipientEmail,
        job.data.recipientName,
        job.data.title,
        job.data.content,
        job.data.category,
        job.data.priority,
        job.data.companyName,
      );
      return;
    }

    this.logger.warn(`Unexpected job type in bulk queue: ${job.data.type}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJob>, error: Error): void {
    this.logger.error(
      `Bulk job failed id=${job.id} attempt=${job.attemptsMade}: ${error.message}`,
      error.stack,
    );
  }
}
