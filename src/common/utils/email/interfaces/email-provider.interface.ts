import { NewTeamMemberAnnouncementPayload } from '../sendgrid.service';

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface IEmailProvider {
  sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName: string,
    companyName: string,
  ): Promise<void>;
  sendPasswordResetSuccessEmail(
    email: string,
    userName: string,
    companyName: string,
  ): Promise<void>;
  sendWelcomeEmail(
    email: string,
    resetToken: string,
    userName: string,
    companyName: string,
  ): Promise<void>;
  sendEmail(
    to: string,
    subject: string,
    html: string,
    from?: string,
  ): Promise<void>;
  sendBulkEmail(
    emails: string[],
    subject: string,
    html: string,
    from?: string,
  ): Promise<void>;
  sendNewTeamMemberAnnouncementEmail(
    payload: NewTeamMemberAnnouncementPayload,
  ): Promise<void>;
  sendAnnouncementEmail(
    recipientEmail: string,
    recipientName: string,
    title: string,
    content: string,
    category: string,
    priority: string,
    companyName: string,
  ): Promise<void>;
}
