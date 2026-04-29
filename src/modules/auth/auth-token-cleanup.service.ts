import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { UserToken } from "../../entities/user-token.entity";

/**
 * Nightly job that removes stale rows from user_tokens.
 *
 * Revoked / expired rows are kept for a 30-day window so that any
 * reuse-after-rotation attack (a stolen refresh token replayed after the
 * legitimate owner already rotated it) can still be detected and all sessions
 * can be nuked. After 30 days the row has no security value and is deleted.
 */
@Injectable()
export class AuthTokenCleanupService {
  private readonly logger = new Logger(AuthTokenCleanupService.name);

  constructor(
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
  ) {}

  /** Runs at 03:00 every night. */
  @Cron("0 3 * * *")
  async purgeStaleTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    try {
      const result = await this.userTokenRepository
        .createQueryBuilder()
        .delete()
        .where("(is_revoked = true OR expires_at < :now) AND created_at < :cutoff", {
          now: new Date(),
          cutoff,
        })
        .execute();

      const count = result.affected ?? 0;
      if (count > 0) {
        this.logger.log(`Purged ${count} stale token row(s) older than 30 days`);
      } else {
        this.logger.debug("No stale token rows to purge");
      }
    } catch (err) {
      this.logger.error(`Token cleanup failed: ${String(err)}`);
    }
  }
}
