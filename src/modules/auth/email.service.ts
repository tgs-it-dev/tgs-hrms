import { Injectable, Logger } from "@nestjs/common";
import { SendGridService } from "./sendgrid.service";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly sendGridService: SendGridService,
  ) {}

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName: string,
  ): Promise<void> {
    try {
      await this.sendGridService.sendPasswordResetEmail(
        email,
        resetToken,
        userName,
      );
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
    try {
      await this.sendGridService.sendPasswordResetSuccessEmail(email, userName);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset success email to ${email}:`,
        error,
      );
    }
  }
}
