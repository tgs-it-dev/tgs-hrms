import { EmailJobType, ThrottleRule } from '../interfaces/email-job.interface';

/**
 * Transactional queue: auth, notifications, invitations.
 * Processed with high throughput + BullMQ global rate limiter.
 */
export const EMAIL_TRANSACTIONAL_QUEUE = 'email-transactional';

/**
 * Bulk queue: announcements, team broadcasts.
 * Intentionally slower — uses a stricter rate limiter.
 */
export const EMAIL_BULK_QUEUE = 'email-bulk';

/**
 * Per-user, per-action throttle rules enforced in Redis before
 * the job is even enqueued. Acts as a first line of abuse prevention.
 *
 * Overridable via env vars at runtime (see EmailThrottleService).
 */
export const DEFAULT_THROTTLE_RULES: Record<EmailJobType, ThrottleRule> = {
  [EmailJobType.PASSWORD_RESET]: {
    limit: 3,
    windowMs: 60 * 60 * 1_000,
    label: 'password-reset/hour',
  },
  [EmailJobType.PASSWORD_RESET_SUCCESS]: {
    limit: 5,
    windowMs: 60 * 60 * 1_000,
    label: 'password-reset-success/hour',
  },
  [EmailJobType.WELCOME]: {
    limit: 3,
    windowMs: 24 * 60 * 60 * 1_000,
    label: 'welcome/day',
  },
  [EmailJobType.NOTIFICATION]: {
    limit: 50,
    windowMs: 60 * 60 * 1_000,
    label: 'notification/hour',
  },
  [EmailJobType.INVITATION]: {
    limit: 20,
    windowMs: 24 * 60 * 60 * 1_000,
    label: 'invitation/day',
  },
  [EmailJobType.REMINDER]: {
    limit: 10,
    windowMs: 60 * 60 * 1_000,
    label: 'reminder/hour',
  },
  [EmailJobType.ANNOUNCEMENT]: {
    limit: 100,
    windowMs: 24 * 60 * 60 * 1_000,
    label: 'announcement/day',
  },
  [EmailJobType.NEW_TEAM_MEMBER]: {
    limit: 50,
    windowMs: 24 * 60 * 60 * 1_000,
    label: 'new-team-member/day',
  },
  [EmailJobType.GENERIC]: {
    limit: 30,
    windowMs: 60 * 60 * 1_000,
    label: 'generic/hour',
  },
  [EmailJobType.BULK]: {
    limit: 5,
    windowMs: 60 * 60 * 1_000,
    label: 'bulk/hour',
  },
};

/** BullMQ job options per queue (retry + backoff). */
export const TRANSACTIONAL_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 2_000, // 2s → 4s → 8s → 16s → 32s
  },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};

export const BULK_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5_000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};
