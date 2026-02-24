/**
 * SendGrid-only email service. Any module can inject this to send emails.
 * No business logic (e.g. reset, announcement) — that lives in respective modules.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import { ContextLogger, LoggerService } from '../../logger/logger.service';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.forChild(EmailService.name);
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid API key configured successfully');
    } else {
      this.logger.warn('SENDGRID_API_KEY not found. Email functionality will be disabled.');
    }
  }

  /** Default "from" address from config. */
  getFromEmail(): string | null {
    return this.configService.get<string>('SENDGRID_FROM') ?? null;
  }

  /**
   * Send a single or multiple recipients. Uses SENDGRID_FROM when from is omitted.
   */
  async send(options: SendMailOptions): Promise<void> {
    const from = options.from ?? this.getFromEmail();
    if (!from) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping email send.');
      return;
    }
    const msg = { to: options.to, from, subject: options.subject, html: options.html };
    return this.sendOrThrow(msg, `Email to ${Array.isArray(options.to) ? options.to.length : 1} recipient(s)`);
  }

  /**
   * Send the same email to multiple recipients (convenience for to[]).
   */
  async sendBulk(to: string[], subject: string, html: string, from?: string): Promise<void> {
    await this.send({ to, subject, html, from });
  }

  private async sendOrThrow(
    msg: { to: string | string[]; from: string; subject: string; html: string },
    description: string,
  ): Promise<void> {
    try {
      await sgMail.send(msg);
      this.logger.log(`${description} sent successfully`);
    } catch (error) {
      this.logger.error(`Failed to send ${description}:`, error);
      throw new Error(`Failed to send ${description}`);
    }
  }
}
