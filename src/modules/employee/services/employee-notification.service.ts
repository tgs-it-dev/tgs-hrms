import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EmailService, EmailTemplateService } from '../../../common/utils/email';
import { User } from '../../../entities/user.entity';

@Injectable()
export class EmployeeNotificationService {
  private readonly logger = new Logger(EmployeeNotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async sendWelcomeEmail(email: string, resetToken: string, userName = ''): Promise<void> {
    const from = this.emailService.getFromEmail();
    if (!from) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping welcome email.');
      return;
    }
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
    const resetUrl = `${frontendUrl}/confirm-password?token=${resetToken}`;
    const html = this.emailTemplateService.render('employee-welcome', { resetUrl, userName });
    await this.emailService.send({
      to: email,
      from,
      subject: 'Welcome to HRMS - Set Your Password',
      html,
    });
  }

  private async sendNewTeamMemberAnnouncementEmail(
    recipientEmail: string,
    newEmployeeName: string,
    newEmployeeEmail: string,
  ): Promise<void> {
    const from = this.emailService.getFromEmail();
    if (!from) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping new team member email.');
      return;
    }
    const html = this.emailTemplateService.render('new-team-member', {
      newEmployeeName,
      newEmployeeEmail,
    });
    await this.emailService.send({
      to: recipientEmail,
      from,
      subject: 'New Team Member Joined',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    try {
      await this.sendWelcomeEmail(email, resetToken);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}: ${this.errorMessage(error)}`);
      this.logger.warn('Email sending failed, but continuing with employee creation');
    }
  }

  /**
   * Sends "New team member joined" email to all other users in the same tenant.
   * Tenant isolation: only users with tenant_id = tenant_id receive the email; the new employee is excluded.
   */
  async sendNewEmployeeAnnouncementToTenant(
    tenant_id: string,
    excludeUserId: string,
    newEmployeeName: string,
    newEmployeeEmail: string,
  ): Promise<void> {
    try {
      const tenantUsers = await this.userRepo.find({
        where: { tenant_id },
        select: ['id', 'email'],
      });
      const recipients = tenantUsers.filter((u) => u.id !== excludeUserId && u.email);
      if (recipients.length === 0) {
        this.logger.log(`No other tenant users to notify for new employee (tenant: ${tenant_id})`);
        return;
      }
      const results = await Promise.allSettled(
        recipients.map((recipient) =>
          this.sendNewTeamMemberAnnouncementEmail(recipient.email, newEmployeeName, newEmployeeEmail),
        ),
      );
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          const email = recipients[i]?.email;
          this.logger.error(`Failed to send new employee announcement to ${email}: ${this.errorMessage(r.reason)}`);
        }
      });
      this.logger.log(`New employee announcement sent to ${recipients.length} tenant member(s) (tenant: ${tenant_id})`);
    } catch (error) {
      this.logger.error(`Failed to send new employee announcement to tenant ${tenant_id}: ${this.errorMessage(error)}`);
    }
  }
}
