import { NewTeamMemberAnnouncementPayload } from '../sendgrid.service';

export enum EmailJobType {
  PASSWORD_RESET = 'password_reset',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  WELCOME = 'welcome',
  NOTIFICATION = 'notification',
  INVITATION = 'invitation',
  REMINDER = 'reminder',
  ANNOUNCEMENT = 'announcement',
  NEW_TEAM_MEMBER = 'new_team_member',
  GENERIC = 'generic',
  BULK = 'bulk',
}

/** BullMQ job priority — lower number = higher priority. */
export enum EmailPriority {
  HIGH = 1, // OTP, auth, password-reset
  MEDIUM = 5, // notifications, invitations
  LOW = 20, // announcements, bulk
}

interface BaseEmailJob {
  type: EmailJobType;
  /** Used for per-user throttle enforcement. */
  userId?: string;
  tenantId?: string;
  correlationId?: string;
}

export interface PasswordResetEmailJob extends BaseEmailJob {
  type: EmailJobType.PASSWORD_RESET;
  email: string;
  resetToken: string;
  userName: string;
  companyName: string;
}

export interface PasswordResetSuccessEmailJob extends BaseEmailJob {
  type: EmailJobType.PASSWORD_RESET_SUCCESS;
  email: string;
  userName: string;
  companyName: string;
}

export interface WelcomeEmailJob extends BaseEmailJob {
  type: EmailJobType.WELCOME;
  email: string;
  resetToken: string;
  userName: string;
  companyName: string;
}

export interface NotificationEmailJob extends BaseEmailJob {
  type: EmailJobType.NOTIFICATION;
  email: string;
  title: string;
  message: string;
}

export interface InvitationEmailJob extends BaseEmailJob {
  type: EmailJobType.INVITATION;
  email: string;
  userName: string;
  companyName: string;
  inviteToken: string;
}

export interface ReminderEmailJob extends BaseEmailJob {
  type: EmailJobType.REMINDER;
  email: string;
  title: string;
  message: string;
  actionUrl?: string;
}

export interface AnnouncementEmailJob extends BaseEmailJob {
  type: EmailJobType.ANNOUNCEMENT;
  recipientEmail: string;
  recipientName: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  companyName: string;
}

export interface NewTeamMemberEmailJob extends BaseEmailJob {
  type: EmailJobType.NEW_TEAM_MEMBER;
  payload: NewTeamMemberAnnouncementPayload;
}

export interface GenericEmailJob extends BaseEmailJob {
  type: EmailJobType.GENERIC;
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface BulkEmailJob extends BaseEmailJob {
  type: EmailJobType.BULK;
  emails: string[];
  subject: string;
  html: string;
  from?: string;
}

export type EmailJob =
  | PasswordResetEmailJob
  | PasswordResetSuccessEmailJob
  | WelcomeEmailJob
  | NotificationEmailJob
  | InvitationEmailJob
  | ReminderEmailJob
  | AnnouncementEmailJob
  | NewTeamMemberEmailJob
  | GenericEmailJob
  | BulkEmailJob;

/** Per-action throttle rule for a given email type. */
export interface ThrottleRule {
  /** Maximum sends allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Human-readable label used in error messages and logs. */
  label: string;
}
