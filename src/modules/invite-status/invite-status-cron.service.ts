import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InviteStatusService } from "./invite-status.service";

@Injectable()
export class InviteStatusCronService implements OnModuleInit {
  private readonly logger = new Logger(InviteStatusCronService.name);

  constructor(private readonly inviteStatusService: InviteStatusService) {}

  onModuleInit() {
    this.logger.log("Starting invite status cron service...");

    // Run once shortly after startup (5 seconds delay)
    setTimeout(() => {
      this.checkExpiredInvites().catch((error) => {
        this.logger.error("Initial invite status check failed:", error);
      });
    }, 5000);

    // Then run every 15 minutes
    setInterval(
      () => {
        this.checkExpiredInvites().catch((error) => {
          this.logger.error("Scheduled invite status check failed:", error);
        });
      },
      15 * 60 * 1000,
    ); // 15 minutes

    this.logger.log("Invite status cron service started successfully");
  }

  private async checkExpiredInvites(): Promise<void> {
    try {
      this.logger.log("Checking for expired invites...");
      const expiredCount =
        await this.inviteStatusService.checkAndUpdateExpiredInvites();

      if (expiredCount > 0) {
        this.logger.log(
          `Updated ${expiredCount} expired invites to 'Invite Expired'`,
        );
      } else {
        this.logger.debug("No expired invites found");
      }
    } catch (error) {
      this.logger.error("Failed to check expired invites:", error);
      throw error;
    }
  }

  /**
   * Manually trigger expired invite check (useful for testing or manual runs)
   */
  async manualCheckExpiredInvites(): Promise<number> {
    this.logger.log("Manual expired invite check triggered");
    return await this.inviteStatusService.checkAndUpdateExpiredInvites();
  }
}
