/**
 * Email Integration Tests
 *
 * These tests spin up the real NestJS EmailModule, enqueue real jobs through
 * BullMQ, and verify that emails actually reach the inbox.
 *
 * Prerequisites:
 *   1. Redis running on REDIS_HOST:REDIS_PORT (default localhost:6379)
 *   2. SENDGRID_API_KEY + SENDGRID_FROM set in .env
 *
 * Run:
 *   npx jest email.integration.spec --testTimeout=60000 --runInBand
 *
 * All emails are sent to TEST_RECIPIENT (muhammad.saad+21@thetgs.com).
 * Throttle counters are auto-cleaned after each test.
 */

// Load .env before any NestJS modules — Redis password must be in process.env
// when isRedisAvailable() fires, before ConfigModule is initialised.
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { EmailModule } from './email.module';
import { EmailService } from './email.service';
import { EmailThrottleService } from './email-throttle.service';
import { EmailJobType } from './interfaces/email-job.interface';
import {
  EMAIL_TRANSACTIONAL_QUEUE,
  EMAIL_BULK_QUEUE,
} from './constants/email-queue.constants';

// ─── Test constants ──────────────────────────────────────────────────────────

const TEST_RECIPIENT = 'muhammad.saad+21@thetgs.com';
const TEST_COMPANY = 'WorkOnnect (Test)';
const QUEUE_DRAIN_TIMEOUT_MS = 30_000;
const QUEUE_POLL_INTERVAL_MS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Polls until both queues have no waiting/active/delayed jobs. */
async function waitForQueues(
  transactional: Queue,
  bulk: Queue,
  timeoutMs = QUEUE_DRAIN_TIMEOUT_MS,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [t, b] = await Promise.all([
      transactional.getJobCounts('waiting', 'active', 'delayed'),
      bulk.getJobCounts('waiting', 'active', 'delayed'),
    ]);
    const pending =
      t.waiting + t.active + t.delayed + b.waiting + b.active + b.delayed;
    if (pending === 0) return;
    await new Promise((r) => setTimeout(r, QUEUE_POLL_INTERVAL_MS));
  }
  throw new Error(
    `Queues did not drain within ${timeoutMs}ms — check worker logs`,
  );
}

/** Deletes all throttle keys for test users so tests start clean. */
async function flushThrottleKeys(redis: Redis, pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}

/** Checks Redis reachability before running the suite. */
async function isRedisAvailable(
  url: string,
  password?: string,
): Promise<boolean> {
  const client = new Redis(url, {
    password,
    connectTimeout: 2_000,
    lazyConnect: true,
    tls: undefined,
  });
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Email Integration Tests', () => {
  let moduleRef: TestingModule;
  let emailService: EmailService;
  let throttleService: EmailThrottleService;
  let transactionalQueue: Queue;
  let bulkQueue: Queue;
  let testRedis: Redis;
  let skipAll = false;

  // Unique suffix per run so throttle counters from previous runs don't leak
  const runId = Date.now().toString();

  beforeAll(async () => {
    // const redisHost = process.env.REDIS_HOST ?? 'localhost';
    // const redisPort = parseInt(process.env.REDIS_PORT ?? '6379', 10);
    const redisURL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    const redisReady = await isRedisAvailable(
      redisURL,
      process.env.REDIS_PASSWORD,
    );
    if (!redisReady) {
      console.warn(
        `\n⚠️  Redis not reachable at ${redisURL}.\n` +
          '   Start Redis (e.g. docker run -d -p 6379:6379 redis:alpine)\n' +
          '   and re-run the tests. Skipping all email integration tests.\n',
      );
      skipAll = true;
      return;
    }

    try {
      moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          EmailModule,
        ],
      }).compile();
    } catch (err) {
      console.error(
        '\n❌  Failed to compile EmailModule:',
        (err as Error).message,
      );
      skipAll = true;
      return;
    }

    const app = moduleRef.createNestApplication();
    await app.init();

    emailService = moduleRef.get(EmailService);
    throttleService = moduleRef.get(EmailThrottleService);
    transactionalQueue = moduleRef.get<Queue>(
      getQueueToken(EMAIL_TRANSACTIONAL_QUEUE),
    );
    bulkQueue = moduleRef.get<Queue>(getQueueToken(EMAIL_BULK_QUEUE));

    testRedis = new Redis(redisURL, {
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

    // Clean any leftover throttle keys from this run prefix
    await flushThrottleKeys(testRedis, `email:throttle:test-${runId}-*`);
  }, 30_000);

  afterAll(async () => {
    if (skipAll) return;
    await flushThrottleKeys(testRedis, `email:throttle:test-${runId}-*`);
    await testRedis.quit();
    await moduleRef.close();
  });

  afterEach(async () => {
    if (skipAll) return;
    // Drain queues between tests so job counts don't bleed across assertions
    await waitForQueues(transactionalQueue, bulkQueue);
  }, QUEUE_DRAIN_TIMEOUT_MS + 5_000);

  // ── Guard ──────────────────────────────────────────────────────────────────

  const skip = () => skipAll;

  // ─────────────────────────────────────────────────────────────────────────
  // 1. TRANSACTIONAL EMAIL DELIVERY
  // ─────────────────────────────────────────────────────────────────────────

  describe('Transactional Email Delivery', () => {
    it(
      'sends a password-reset email',
      async () => {
        if (skip()) return;

        await emailService.sendPasswordResetEmail(
          TEST_RECIPIENT,
          'test-reset-token-abc123',
          'Saad Qureshi',
          TEST_COMPANY,
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'sends a password-reset-success email',
      async () => {
        if (skip()) return;

        await emailService.sendPasswordResetSuccessEmail(
          TEST_RECIPIENT,
          'Saad Qureshi',
          TEST_COMPANY,
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'sends a welcome / set-password email',
      async () => {
        if (skip()) return;

        await emailService.sendWelcomeEmail(
          TEST_RECIPIENT,
          'test-welcome-token-xyz789',
          'Saad Qureshi',
          TEST_COMPANY,
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'sends a notification email',
      async () => {
        if (skip()) return;

        await emailService.sendNotificationEmail(
          TEST_RECIPIENT,
          'Leave Request Approved',
          'Your leave request for May 10–12 has been approved by your manager.',
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'sends an invitation email',
      async () => {
        if (skip()) return;

        await emailService.sendInvitationEmail(
          TEST_RECIPIENT,
          'Saad Qureshi',
          TEST_COMPANY,
          'test-invite-token-def456',
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'sends a reminder email without action URL',
      async () => {
        if (skip()) return;

        await emailService.sendReminderEmail(
          TEST_RECIPIENT,
          'Submit Your Timesheet',
          'You have not submitted your timesheet for the week of April 28.',
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'sends a reminder email with action URL',
      async () => {
        if (skip()) return;

        await emailService.sendReminderEmail(
          TEST_RECIPIENT,
          'Performance Review Due',
          'Your Q2 self-review is due by Friday, May 9.',
          'http://localhost:5173/performance/reviews',
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'sends a generic HTML email',
      async () => {
        if (skip()) return;

        const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#2563eb">Generic Email Test</h2>
          <p>This is a <strong>generic email</strong> sent via the queue system.</p>
          <p>Run ID: <code>${runId}</code></p>
        </div>`;

        await emailService.sendEmail(
          TEST_RECIPIENT,
          `[Queue Test] Generic Email — Run ${runId}`,
          html,
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. BULK EMAIL DELIVERY
  // ─────────────────────────────────────────────────────────────────────────

  describe('Bulk Email Delivery', () => {
    it(
      'sends a bulk email to multiple recipients',
      async () => {
        if (skip()) return;

        // Using the same address with + aliases to simulate multiple recipients
        await emailService.sendBulkEmail(
          [TEST_RECIPIENT, 'muhammad.saad+22@thetgs.com'],
          `[Bulk Test] Team Update — Run ${runId}`,
          `<div style="font-family:Arial,sans-serif;padding:24px">
          <h2>Bulk Email Test</h2>
          <p>This message was sent to a list of recipients via the bulk queue.</p>
          <p>Run ID: ${runId}</p>
        </div>`,
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'sends a company announcement email (low priority)',
      async () => {
        if (skip()) return;

        await emailService.sendAnnouncementEmail(
          TEST_RECIPIENT,
          'Saad Qureshi',
          'Eid Holiday Notice',
          'The office will be closed from June 6–8 for Eid ul-Adha. Wishing everyone a joyful celebration.',
          'holiday',
          'high',
          TEST_COMPANY,
        );

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'sends a new team member announcement',
      async () => {
        if (skip()) return;

        await emailService.sendNewTeamMemberAnnouncementEmail({
          recipientEmail: TEST_RECIPIENT,
          recipientName: 'Saad Qureshi',
          newMember: {
            name: 'Ali Hassan',
            email: 'ali.hassan@thetgs.com',
            department: 'Engineering',
            jobTitle: 'Backend Engineer',
            joinedDate: 'May 5, 2026',
          },
          companyName: TEST_COMPANY,
          viewTeamUrl: 'http://localhost:5173/team',
        });

        await waitForQueues(transactionalQueue, bulkQueue);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PER-USER THROTTLE ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────

  describe('Per-User Throttle Enforcement', () => {
    /**
     * Password-reset limit = 3 per hour.
     * We exhaust the limit then verify the 4th call is blocked.
     */
    it(
      'blocks password-reset emails above the limit (3/hour) with HTTP 429',
      async () => {
        if (skip()) return;

        const userId = `test-${runId}-throttle-pw-reset`;

        // Calls 1–3: must succeed
        for (let i = 1; i <= 3; i++) {
          await expect(
            emailService.sendPasswordResetEmail(
              TEST_RECIPIENT,
              `throttle-token-${i}`,
              'Throttle Test User',
              TEST_COMPANY,
              userId,
            ),
          ).resolves.toBeUndefined();
        }

        // Call 4: must be blocked with HTTP 429
        let caught: unknown;
        try {
          await emailService.sendPasswordResetEmail(
            TEST_RECIPIENT,
            'throttle-token-4',
            'Throttle Test User',
            TEST_COMPANY,
            userId,
          );
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(HttpException);
        const ex = caught as HttpException;
        const body = ex.getResponse() as Record<string, unknown>;
        expect(ex.getStatus()).toBe(429);
        expect(typeof body.message).toBe('string');
        expect((body.message as string).includes('password_reset')).toBe(true);
        expect(typeof body.retryAfter).toBe('number');
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'exposes remaining quota via getRemainingQuota()',
      async () => {
        if (skip()) return;

        const userId = `test-${runId}-quota-check`;

        // Fresh user — full quota
        const before = await throttleService.getRemainingQuota(
          userId,
          EmailJobType.PASSWORD_RESET,
        );
        expect(before.remaining).toBe(3);

        // Use one slot
        await emailService.sendPasswordResetEmail(
          TEST_RECIPIENT,
          'quota-token-1',
          'Quota Test User',
          TEST_COMPANY,
          userId,
        );

        const after = await throttleService.getRemainingQuota(
          userId,
          EmailJobType.PASSWORD_RESET,
        );
        expect(after.remaining).toBe(2);
        expect(after.resetInMs).toBeGreaterThan(0);
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'skips throttle when no userId is passed (system emails)',
      async () => {
        if (skip()) return;

        // Calling many times without userId must never throw throttle errors
        const sends = Array.from({ length: 5 }, (_, i) =>
          emailService.sendNotificationEmail(
            TEST_RECIPIENT,
            `System Notification ${i + 1}`,
            'This email was sent without a userId — throttle should be skipped.',
            // no userId
          ),
        );

        await expect(Promise.all(sends)).resolves.toBeDefined();
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'enforces throttle independently per action type',
      async () => {
        if (skip()) return;

        const userId = `test-${runId}-per-action`;

        // Exhaust password_reset quota (limit = 3)
        for (let i = 1; i <= 3; i++) {
          await emailService.sendPasswordResetEmail(
            TEST_RECIPIENT,
            `per-action-token-${i}`,
            'Per Action Test',
            TEST_COMPANY,
            userId,
          );
        }

        // password_reset is exhausted — should throw
        await expect(
          emailService.sendPasswordResetEmail(
            TEST_RECIPIENT,
            'per-action-token-4',
            'Per Action Test',
            TEST_COMPANY,
            userId,
          ),
        ).rejects.toMatchObject({ status: 429 });

        // notification is a different action — still has full quota, should succeed
        await expect(
          emailService.sendNotificationEmail(
            TEST_RECIPIENT,
            'Independent Action',
            'Notification throttle is independent of password-reset throttle.',
            userId,
          ),
        ).resolves.toBeUndefined();
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it('enforces throttle across simulated "multiple instances" (same Redis)', async () => {
      if (skip()) return;

      /**
       * Both "instances" share the same Redis — mimics horizontal scaling.
       * We use the EmailThrottleService directly to simulate two pods hitting
       * the same counter atomically.
       */
      const userId = `test-${runId}-multi-instance`;

      // Use up 2 of 3 slots via the service (simulating instance A)
      const { allowed: slot1 } = await throttleService.isAllowed(
        userId,
        EmailJobType.PASSWORD_RESET,
      );
      const { allowed: slot2 } = await throttleService.isAllowed(
        userId,
        EmailJobType.PASSWORD_RESET,
      );
      const { allowed: slot3 } = await throttleService.isAllowed(
        userId,
        EmailJobType.PASSWORD_RESET,
      );

      // 4th call (simulating instance B) must be blocked
      const { allowed: slot4, retryAfterMs } = await throttleService.isAllowed(
        userId,
        EmailJobType.PASSWORD_RESET,
      );

      expect(slot1).toBe(true);
      expect(slot2).toBe(true);
      expect(slot3).toBe(true);
      expect(slot4).toBe(false);
      expect(retryAfterMs).toBeGreaterThan(0);
    });

    it(
      'reports correct retryAfter in the 429 response',
      async () => {
        if (skip()) return;

        const userId = `test-${runId}-retry-after`;

        // Exhaust the limit
        for (let i = 0; i < 3; i++) {
          await emailService.sendPasswordResetEmail(
            TEST_RECIPIENT,
            `retry-token-${i}`,
            'Retry After Test',
            TEST_COMPANY,
            userId,
          );
        }

        try {
          await emailService.sendPasswordResetEmail(
            TEST_RECIPIENT,
            'retry-token-final',
            'Retry After Test',
            TEST_COMPANY,
            userId,
          );
          fail('Expected HTTP 429 but no error was thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(HttpException);
          const response = (err as HttpException).getResponse() as Record<
            string,
            unknown
          >;
          expect(response.retryAfter).toBeGreaterThan(0);
          expect(response.retryAfter).toBeLessThanOrEqual(3600); // within the 1-hour window
        }
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. QUEUE INFRASTRUCTURE
  // ─────────────────────────────────────────────────────────────────────────

  describe('Queue Infrastructure', () => {
    it(
      'enqueues transactional job with correct name and data',
      async () => {
        if (skip()) return;

        // Pause before enqueue so the worker can't pick it up immediately
        await transactionalQueue.pause();

        await emailService.sendNotificationEmail(
          TEST_RECIPIENT,
          'Queue Inspection Test',
          'Testing that the job is stored correctly in BullMQ.',
        );

        // BullMQ v5: prioritized jobs live in the 'prioritized' bucket, not 'waiting'
        const jobs = await transactionalQueue.getJobs([
          'waiting',
          'prioritized',
        ]);
        const notifJob = jobs.find(
          (j) => j.name === (EmailJobType.NOTIFICATION as string),
        );

        expect(notifJob).toBeDefined();
        expect((notifJob!.data as { email: string }).email).toBe(
          TEST_RECIPIENT,
        );
        expect(notifJob!.opts.attempts).toBe(5);
        expect(notifJob!.opts.backoff).toMatchObject({ type: 'exponential' });

        await transactionalQueue.resume();
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'enqueues high-priority job with lower priority number than medium',
      async () => {
        if (skip()) return;

        // Pause queues to inspect priority before processing
        await transactionalQueue.pause();

        await emailService.sendPasswordResetEmail(
          TEST_RECIPIENT,
          'priority-token',
          'Priority Test',
          TEST_COMPANY,
        );
        await emailService.sendNotificationEmail(
          TEST_RECIPIENT,
          'Medium Priority Test',
          'This is a medium priority notification.',
        );

        // BullMQ v5: prioritized jobs live in the 'prioritized' bucket
        const jobs = await transactionalQueue.getJobs([
          'waiting',
          'prioritized',
        ]);
        const resetJob = jobs.find(
          (j) => j.name === (EmailJobType.PASSWORD_RESET as string),
        );
        const notifJob = jobs.find(
          (j) => j.name === (EmailJobType.NOTIFICATION as string),
        );

        expect(resetJob).toBeDefined();
        expect(notifJob).toBeDefined();
        // Lower priority number = processed first
        expect(resetJob!.opts.priority).toBeLessThan(notifJob!.opts.priority!);

        await transactionalQueue.resume();
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );

    it(
      'bulk email lands in the bulk queue, not the transactional queue',
      async () => {
        if (skip()) return;

        await bulkQueue.pause();

        await emailService.sendBulkEmail(
          [TEST_RECIPIENT],
          'Bulk Queue Routing Test',
          '<p>This should be in the bulk queue.</p>',
        );

        const transJobs = await transactionalQueue.getJobs([
          'waiting',
          'prioritized',
        ]);
        const bulkJobs = await bulkQueue.getJobs(['waiting', 'prioritized']);

        const inTrans = transJobs.some(
          (j) => j.name === (EmailJobType.BULK as string),
        );
        const inBulk = bulkJobs.some(
          (j) => j.name === (EmailJobType.BULK as string),
        );

        expect(inTrans).toBe(false);
        expect(inBulk).toBe(true);

        await bulkQueue.resume();
      },
      QUEUE_DRAIN_TIMEOUT_MS,
    );
  });
});
