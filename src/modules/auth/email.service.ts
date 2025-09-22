import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService
  ) {}

  async sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Request',
        template: 'password-reset',
        context: {
          userName,
          resetUrl,
          resetToken,
          frontendUrl,
        },
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendPasswordResetSuccessEmail(email: string, userName: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Successful',
        template: 'password-reset-success',
        context: {
          userName,
        },
      });

      this.logger.log(`Password reset success email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset success email to ${email}:`, error);
    }
  }
}
