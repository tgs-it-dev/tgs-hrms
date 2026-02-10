/**
 * Email Service
 * Single place for all email operations. Uses SendGrid and templates from src/templates.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import { EmailTemplateService } from './email-template.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: EmailTemplateService,
  ) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid API key configured successfully');
    } else {
      this.logger.warn('SENDGRID_API_KEY not found. Email functionality will be disabled.');
    }
  }

  private getFromEmail(): string | null {
    return this.configService.get<string>('SENDGRID_FROM') ?? null;
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

  async sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<void> {
    const fromEmail = this.getFromEmail();
    if (!fromEmail) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping email send.');
      return;
    }
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const html = this.templateService.render('password-reset', { userName, resetUrl });
    const msg = { to: email, from: fromEmail, subject: 'Password Reset Request', html };
    await this.sendOrThrow(msg, `Password reset email to ${email}`);
  }

  async sendPasswordResetSuccessEmail(email: string, userName: string): Promise<void> {
    const fromEmail = this.getFromEmail();
    if (!fromEmail) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping email send.');
      return;
    }
    const html = this.templateService.render('password-reset-success', { userName });
    const msg = { to: email, from: fromEmail, subject: 'Password Reset Successful', html };
    try {
      await sgMail.send(msg);
      this.logger.log(`Password reset success email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset success email to ${email}:`, error);
    }
  }

  async sendWelcomeEmail(email: string, resetToken: string, userName?: string): Promise<void> {
    const fromEmail = this.getFromEmail();
    if (!fromEmail) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping email send.');
      return;
    }
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
    const resetUrl = `${frontendUrl}/confirm-password?token=${resetToken}`;
    const html = this.templateService.render('employee-welcome', { resetUrl, userName: userName ?? '' });
    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Welcome to HRMS - Set Your Password',
      html,
    };
    await this.sendOrThrow(msg, `Welcome email to ${email}`);
  }

  async sendEmail(to: string, subject: string, html: string, from?: string): Promise<void> {
    const fromEmail = from ?? this.getFromEmail();
    if (!fromEmail) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping email send.');
      return;
    }
    const msg = { to, from: fromEmail, subject, html };
    await this.sendOrThrow(msg, `Email to ${to}`);
  }

  async sendBulkEmail(emails: string[], subject: string, html: string, from?: string): Promise<void> {
    const fromEmail = from ?? this.getFromEmail();
    if (!fromEmail) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping bulk email send.');
      return;
    }
    const msg = { to: emails, from: fromEmail, subject, html };
    await this.sendOrThrow(msg, `Bulk email to ${emails.length} recipients`);
  }

  async sendNewTeamMemberAnnouncementEmail(
    recipientEmail: string,
    newEmployeeName: string,
    newEmployeeEmail: string,
  ): Promise<void> {
    const fromEmail = this.getFromEmail();
    if (!fromEmail) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping new team member announcement email.');
      return;
    }
    const html = this.templateService.render('new-team-member', {
      newEmployeeName,
      newEmployeeEmail,
    });
    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject: 'New Team Member Joined',
      html,
    };
    await this.sendOrThrow(msg, `New team member announcement to ${recipientEmail}`);
  }

  async sendAnnouncementEmail(
    recipientEmail: string,
    recipientName: string,
    title: string,
    content: string,
    category: string,
    priority: string,
  ): Promise<void> {
    const fromEmail = this.getFromEmail();
    if (!fromEmail) {
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
    const html = this.templateService.render('announcement', {
      recipientName,
      title,
      contentHtml,
      categoryLabel,
      styleColor: style.color,
      styleBadge: style.badge,
    });
    const subject = `${priority === 'high' ? '🔴 ' : ''}${categoryLabel}: ${title}`;
    const msg = { to: recipientEmail, from: fromEmail, subject, html };
    await this.sendOrThrow(msg, `Announcement email to ${recipientEmail}`);
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
