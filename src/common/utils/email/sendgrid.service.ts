/**
 * SendGrid Email Service
 * Handles all SendGrid email operations
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as sgMail from "@sendgrid/mail";
import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";

const TEMPLATES_DIR = path.join(process.cwd(), "src", "templates");

/** Payload for the "new team member joined" announcement email */
export interface NewTeamMemberAnnouncementPayload {
  recipientEmail: string;
  /** Recipient's display name for the greeting (e.g. "Hi, John") */
  recipientName?: string;
  newMember: {
    name: string;
    email: string;
    department?: string;
    jobTitle?: string;
    joinedDate?: string;
  };
  /** Organization/tenant name for the footer */
  companyName?: string;
  /** URL for the "Check it!" CTA button */
  viewTeamUrl?: string;
}

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("SENDGRID_API_KEY");
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log("SendGrid API key configured successfully");
    } else {
      this.logger.warn(
        "SENDGRID_API_KEY not found. Email functionality will be disabled.",
      );
    }
  }

  /**
   * Renders an Handlebars template from src/templates (same dir as MailerModule).
   * Reusable for any .hbs template to keep sending logic DRY.
   */
  private renderTemplate(
    templateName: string,
    context: Record<string, unknown>,
  ): string {
    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
    const source = fs.readFileSync(templatePath, "utf-8");
    const template = Handlebars.compile(source, { strict: true });
    return template(context);
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName: string,
    companyName: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>("FRONTEND_URL");
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const fromEmail = this.configService.get<string>("SENDGRID_FROM");

    if (!fromEmail) {
      this.logger.warn("SENDGRID_FROM not configured. Skipping email send.");
      return;
    }

    const context = {
      userName,
      resetUrl,
      companyName: companyName ?? "your organization",
    };

    const html = this.renderTemplate("password-reset", context);

    const msg = {
      to: email,
      from: fromEmail,
      subject: "Password Reset Request",
      html,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}:`,
        error,
      );
      throw new Error("Failed to send password reset email");
    }
  }

  async sendPasswordResetSuccessEmail(
    email: string,
    userName: string,
  ): Promise<void> {
    const fromEmail = this.configService.get<string>("SENDGRID_FROM");

    if (!fromEmail) {
      this.logger.warn("SENDGRID_FROM not configured. Skipping email send.");
      return;
    }

    const msg = {
      to: email,
      from: fromEmail,
      subject: "Password Reset Successful",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Successful</h2>
          <p>Hello ${userName},</p>
          <p>Your password has been successfully reset.</p>
          <p>You can now log in to your account with your new password.</p>
          <p>If you didn't make this change, please contact support immediately.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Password reset success email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset success email to ${email}:`,
        error,
      );
    }
  }

  async sendWelcomeEmail(email: string, resetToken: string): Promise<void> {
    const frontendUrl = this.configService.get<string>("FRONTEND_URL");
    const resetUrl = `${frontendUrl}/confirm-password?token=${resetToken}`;
    const fromEmail = this.configService.get<string>("SENDGRID_FROM");

    if (!fromEmail) {
      this.logger.warn("SENDGRID_FROM not configured. Skipping email send.");
      return;
    }

    const msg = {
      to: email,
      from: fromEmail,
      subject: "Welcome to HRMS - Set Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to HRMS!</h2>
          <p>Hello,</p>
          <p>Welcome to our Human Resource Management System. Your account has been created successfully.</p>
          <p>To get started, please set your password by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Set Password
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you have any questions, please contact your administrator.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      throw new Error("Failed to send welcome email");
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    from?: string,
  ): Promise<void> {
    const fromEmail = from || this.configService.get<string>("SENDGRID_FROM");

    if (!fromEmail) {
      this.logger.warn("SENDGRID_FROM not configured. Skipping email send.");
      return;
    }

    const msg = {
      to,
      from: fromEmail,
      subject,
      html,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new Error("Failed to send email");
    }
  }

  async sendBulkEmail(
    emails: string[],
    subject: string,
    html: string,
    from?: string,
  ): Promise<void> {
    const fromEmail = from || this.configService.get<string>("SENDGRID_FROM");

    if (!fromEmail) {
      this.logger.warn(
        "SENDGRID_FROM not configured. Skipping bulk email send.",
      );
      return;
    }

    const msg = {
      to: emails,
      from: fromEmail,
      subject,
      html,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Bulk email sent to ${emails.length} recipients`);
    } catch (error) {
      this.logger.error(
        `Failed to send bulk email to ${emails.length} recipients:`,
        error,
      );
      throw new Error("Failed to send bulk email");
    }
  }

  /**
   * Sends "New team member joined" email to existing tenant employees using the member-joined layout.
   * Used when a new employee is created so all colleagues in the same tenant are notified.
   */
  async sendNewTeamMemberAnnouncementEmail(
    payload: NewTeamMemberAnnouncementPayload,
  ): Promise<void> {
    const fromEmail = this.configService.get<string>("SENDGRID_FROM");

    if (!fromEmail) {
      this.logger.warn(
        "SENDGRID_FROM not configured. Skipping new team member announcement email.",
      );
      return;
    }

    const frontendUrl = this.configService.get<string>("FRONTEND_URL") ?? "#";
    const context = {
      recipientName: payload.recipientName ?? "there",
      name: payload.newMember.name,
      email: payload.newMember.email,
      department: payload.newMember.department ?? "—",
      jobTitle: payload.newMember.jobTitle ?? "—",
      joinedDate:
        payload.newMember.joinedDate ??
        new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      companyName: payload.companyName ?? "your organization",
      viewTeamUrl: payload.viewTeamUrl ?? frontendUrl,
    };

    const html = this.renderTemplate("member-joined", context);

    const msg = {
      to: payload.recipientEmail,
      from: fromEmail,
      subject: "A New Team Member Has Joined!",
      html,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(
        `New team member announcement sent to ${payload.recipientEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send new team member announcement to ${payload.recipientEmail}:`,
        error,
      );
      throw new Error("Failed to send new team member announcement email");
    }
  }

  /**
   * Sends announcement email to a user.
   * Used for company-wide announcements (holidays, events, policies, etc.)
   */
  async sendAnnouncementEmail(
    recipientEmail: string,
    recipientName: string,
    title: string,
    content: string,
    category: string,
    priority: string,
  ): Promise<void> {
    const fromEmail = this.configService.get<string>("SENDGRID_FROM");

    if (!fromEmail) {
      this.logger.warn(
        "SENDGRID_FROM not configured. Skipping announcement email.",
      );
      return;
    }

    // Priority-based styling
    const priorityStyles: Record<string, { color: string; badge: string }> = {
      low: { color: "#28a745", badge: "Low Priority" },
      medium: { color: "#ffc107", badge: "Medium Priority" },
      high: { color: "#dc3545", badge: "High Priority" },
    };

    const categoryLabels: Record<string, string> = {
      general: "General Announcement",
      holiday: "Holiday Notice",
      policy: "Policy Update",
      event: "Event Announcement",
      urgent: "Urgent Notice",
    };

    const style = priorityStyles[priority] || priorityStyles.medium;
    const categoryLabel = categoryLabels[category] || "Announcement";

    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject: `${priority === "high" ? "🔴 " : ""}${categoryLabel}: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <div style="background-color: ${style.color}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${title}</h1>
            <p style="margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
              ${categoryLabel} | ${style.badge}
            </p>
          </div>
          
          <!-- Body -->
          <div style="padding: 30px; background-color: #f9f9f9;">
            <p style="margin-top: 0;">Hello ${recipientName},</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid ${style.color}; margin: 20px 0;">
              ${content.replace(/\n/g, "<br>")}
            </div>
            
            <p style="color: #666; font-size: 14px; margin-bottom: 0;">
              This is an official announcement from your organization. Please take note accordingly.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f0f0f0; padding: 15px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; color: #888; font-size: 12px;">
              This is an automated message from your HRMS. Please do not reply to this email.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(
        `Announcement email sent to ${recipientEmail}: "${title}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send announcement email to ${recipientEmail}:`,
        error,
      );
      throw new Error("Failed to send announcement email");
    }
  }
}
