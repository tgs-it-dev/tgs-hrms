export { EmailModule } from './email.module';
export { EmailService } from './email.service';
export {
  SendGridService,
  type NewTeamMemberAnnouncementPayload,
} from './sendgrid.service';
export { EmailThrottleService } from './email-throttle.service';
export {
  EmailJobType,
  EmailPriority,
  type EmailJob,
  type ThrottleRule,
} from './interfaces/email-job.interface';
export {
  EMAIL_PROVIDER,
  type IEmailProvider,
} from './interfaces/email-provider.interface';
export {
  EMAIL_TRANSACTIONAL_QUEUE,
  EMAIL_BULK_QUEUE,
} from './constants/email-queue.constants';
