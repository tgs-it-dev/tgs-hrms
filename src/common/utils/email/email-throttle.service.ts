import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { EmailJobType, ThrottleRule } from './interfaces/email-job.interface';
import { DEFAULT_THROTTLE_RULES } from './constants/email-queue.constants';
import { EMAIL_TRANSACTIONAL_QUEUE } from './constants/email-queue.constants';

/**
 * Enforces per-user / per-action email rate limits using a Redis fixed-window
 * counter protected by a Lua script for atomic increment-and-check.
 *
 * Works correctly across multiple app instances because all state lives in Redis.
 */
@Injectable()
export class EmailThrottleService {
  private readonly logger = new Logger(EmailThrottleService.name);
  private readonly redis: Redis;

  /**
   * Lua script: atomically increment, set TTL on first hit, and return
   * [current_count, ttl_seconds].  Using EVAL guarantees no race between
   * INCR and EXPIRE even under concurrent requests.
   */
  private static readonly THROTTLE_SCRIPT = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local current = redis.call('INCR', key)
    if current == 1 then
      redis.call('PEXPIRE', key, window)
    end
    local ttl = redis.call('PTTL', key)
    return {current, ttl}
  `;

  constructor(
    @InjectQueue(EMAIL_TRANSACTIONAL_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis(
      this.configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
      { enableReadyCheck: false, maxRetriesPerRequest: null, tls: undefined },
    );

    this.redis.on('error', (err) =>
      this.logger.error('EmailThrottleService Redis error', err),
    );

    this.redis.on('connect', () =>
      this.logger.log('EmailThrottleService connected to Redis'),
    );

    this.redis.on('ready', () =>
      this.logger.log('EmailThrottleService Redis connection is ready'),
    );
  }

  /**
   * Returns true if the action is allowed for this user.
   * Increments the counter atomically — every call counts toward the limit.
   *
   * Pass `userId: undefined` to skip per-user throttling (e.g. system emails).
   */
  async isAllowed(
    userId: string | undefined,
    jobType: EmailJobType,
  ): Promise<{ allowed: boolean; retryAfterMs?: number }> {
    if (!userId) return { allowed: true };

    const rule = this.resolveRule(jobType);
    const key = `email:throttle:${userId}:${jobType}`;

    try {
      const [current, ttl] = (await this.redis.eval(
        EmailThrottleService.THROTTLE_SCRIPT,
        1,
        key,
        rule.limit,
        rule.windowMs,
      )) as [number, number];

      if (current > rule.limit) {
        this.logger.warn(
          `Throttle hit — userId=${userId} type=${jobType} count=${current}/${rule.limit} rule="${rule.label}"`,
        );
        return { allowed: false, retryAfterMs: ttl };
      }

      return { allowed: true };
    } catch (err) {
      // Fail open — if Redis is down, allow the email to avoid blocking auth flows.
      this.logger.error('Throttle Redis error — failing open', err);
      return { allowed: true };
    }
  }

  /** Returns the remaining quota for a user/action without incrementing. */
  async getRemainingQuota(
    userId: string,
    jobType: EmailJobType,
  ): Promise<{ remaining: number; resetInMs: number }> {
    const rule = this.resolveRule(jobType);
    const key = `email:throttle:${userId}:${jobType}`;

    const [raw, ttl] = await Promise.all([
      this.redis.get(key),
      this.redis.pttl(key),
    ]);

    const current = raw ? parseInt(raw, 10) : 0;
    return {
      remaining: Math.max(0, rule.limit - current),
      resetInMs: ttl > 0 ? ttl : 0,
    };
  }

  /**
   * Allows overriding limits via env vars at runtime.
   * Example: EMAIL_THROTTLE_PASSWORD_RESET_LIMIT=5
   */
  private resolveRule(jobType: EmailJobType): ThrottleRule {
    const base = DEFAULT_THROTTLE_RULES[jobType];
    const envKey = `EMAIL_THROTTLE_${jobType.toUpperCase().replace(/-/g, '_')}`;
    const envLimit = this.configService.get<number>(`${envKey}_LIMIT`);
    const envWindow = this.configService.get<number>(`${envKey}_WINDOW_MS`);

    return {
      ...base,
      limit: envLimit ?? base.limit,
      windowMs: envWindow ?? base.windowMs,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
