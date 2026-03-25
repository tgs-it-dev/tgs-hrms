/**
 * Email Service
 * High-level email service that handles all email operations
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendGridService } from './sendgrid.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sendGridService: SendGridService
  ) {}

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName: string,
    companyName: string,
  ): Promise<void> {
    try {
      await this.sendGridService.sendPasswordResetEmail(
        email,
        resetToken,
        userName,
        companyName,
      );
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`,
        error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendPasswordResetSuccessEmail(email: string, userName: string): Promise<void> {
    try {
      await this.sendGridService.sendPasswordResetSuccessEmail(email, userName);
    } catch (error) {
      this.logger.error(`Failed to send password reset success email to ${email}:`, error);
    }
  }

  async sendWelcomeEmail(
    email: string,
    resetToken: string,
    userName: string,
    companyName: string,
  ): Promise<void> {
    try {
      await this.sendGridService.sendWelcomeEmail(
        email,
        resetToken,
        userName,
        companyName,
      );
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      throw new Error('Failed to send welcome email');
    }
  }

  async sendEmail(to: string, subject: string, html: string, from?: string): Promise<void> {
    try {
      await this.sendGridService.sendEmail(to, subject, html, from);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new Error('Failed to send email');
    }
  }

  async sendBulkEmail(emails: string[], subject: string, html: string, from?: string): Promise<void> {
    try {
      await this.sendGridService.sendBulkEmail(emails, subject, html, from);
    } catch (error) {
      this.logger.error(`Failed to send bulk email to ${emails.length} recipients:`, error);
      throw new Error('Failed to send bulk email');
    }
  }

  async sendNotificationEmail(email: string, title: string, message: string): Promise<void> {
    const subject = `Notification: ${title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${title}</h2>
        <p>${message}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    `;

    await this.sendEmail(email, subject, html);
  }

  async sendInvitationEmail(email: string, userName: string, companyName: string, inviteToken: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const inviteUrl = `${frontendUrl}/accept-invitation?token=${inviteToken}`;
    const subject = `Invitation to join ${companyName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're invited to join ${companyName}!</h2>
        <p>Hello ${userName},</p>
        <p>You have been invited to join ${companyName} on our HRMS platform.</p>
        <p>Click the button below to accept the invitation and set up your account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${inviteUrl}</p>
        <p>This invitation will expire in 7 days.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    `;

    await this.sendEmail(email, subject, html);
  }

  async sendReminderEmail(email: string, title: string, message: string, actionUrl?: string): Promise<void> {
    const subject = `Reminder: ${title}`;
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reminder: ${title}</h2>
        <p>${message}</p>
    `;

    if (actionUrl) {
      html += `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" 
             style="background-color: #ffc107; color: black; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Take Action
          </a>
        </div>
      `;
    }

    html += `
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    `;

    await this.sendEmail(email, subject, html);
  }
}
