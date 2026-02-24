/**
 * SendGrid-only email service. Any module can inject this to send emails.
 * No business logic (e.g. reset, announcement) — that lives in respective modules.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import { ContextLogger, LoggerService } from '../../logger/logger.service';
import { EMAIL_MESSAGE } from '../../constants';

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
      this.logger.log(EMAIL_MESSAGE.SENDGRID_CONFIGURED);
    } else {
      this.logger.warn(EMAIL_MESSAGE.SENDGRID_KEY_NOT_FOUND);
    }
  }

  /** Default "from" address from config. */
  getFromEmail(): string | null {
    return this.configService.get<string>('SENDGRID_FROM') ?? null;
  }

  /**
   * Send a single or multiple recipients. Uses SENDGRID_FROM when from is omitted.
   */
  send(options: SendMailOptions): void {
    const from = options.from ?? this.getFromEmail();
    if (!from) {
      this.logger.warn(EMAIL_MESSAGE.SENDGRID_FROM_NOT_CONFIGURED);
      return;
    }
    const msg = { to: options.to, from, subject: options.subject, html: options.html };
    void this.sendOrThrow(msg, `Email to ${Array.isArray(options.to) ? options.to.length : 1} recipient(s)`);
  }

  /**
   * Send the same email to multiple recipients (convenience for to[]).
   */
  sendBulk(to: string[], subject: string, html: string, from?: string): void {
    this.send({ to, subject, html, from });
  }

  private async sendOrThrow(
    msg: { to: string | string[]; from: string; subject: string; html: string },
    description: string,
  ): Promise<void> {
    try {
      await sgMail.send(msg);
      this.logger.log(`${description} ${EMAIL_MESSAGE.SENT_SUCCESS}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`${EMAIL_MESSAGE.SEND_FAILED} ${description}:`, errMsg);
      throw new Error(`${EMAIL_MESSAGE.SEND_FAILED} ${description}`);
    }
  }
}
