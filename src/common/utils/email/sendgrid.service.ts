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

  async sendWelcomeEmail(
    email: string,
    resetToken: string,
    userName: string,
    companyName: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>("FRONTEND_URL");
    const resetUrl = `${frontendUrl}/confirm-password?token=${resetToken}`;
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

    const html = this.renderTemplate("employee-welcome", context);

    const msg = {
      to: email,
      from: fromEmail,
      subject: "Welcome to HRMS - Set Your Password",
      html,
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
    companyName: string,
  ): Promise<void> {
    const fromEmail = this.configService.get<string>("SENDGRID_FROM");

    if (!fromEmail) {
      this.logger.warn(
        "SENDGRID_FROM not configured. Skipping announcement email.",
      );
      return;
    }

    // design is pending so commenting below line.
    // Priority-based styling
    // const priorityStyles: Record<string, { color: string; badge: string }> = {
    //   low: { color: "#28a745", badge: "Low Priority" },
    //   medium: { color: "#ffc107", badge: "Medium Priority" },
    //   high: { color: "#dc3545", badge: "High Priority" },
    // };

    const categoryLabels: Record<string, string> = {
      general: "General Announcement",
      holiday: "Holiday Notice",
      policy: "Policy Update",
      event: "Event Announcement",
      urgent: "Urgent Notice",
    };
    // design is pending so commenting below line.
    // const style = priorityStyles[priority] || priorityStyles.medium;
    const categoryLabel = categoryLabels[category] || "Announcement";

    const context = {
      name: recipientName,
      title,
      message: content,
      companyName,
    };

    const html = this.renderTemplate("announcement-mail", context);

    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject: `${priority === "high" ? "🔴 " : ""}${categoryLabel}: ${title}`,
      html,
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
