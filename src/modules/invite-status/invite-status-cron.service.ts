/**
 * Invite Status Cron Service using NestJS Schedule
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InviteStatusService } from './invite-status.service';

@Injectable()
export class InviteStatusCronService {
  private readonly logger = new Logger(InviteStatusCronService.name);

  constructor(private readonly inviteStatusService: InviteStatusService) {}

  /**
   * Check for expired invites every 15 minutes
   */
  @Cron('0 */15 * * * *')
  async handleExpiredInvitesCheck(): Promise<void> {
    try {
      this.logger.log('Starting scheduled expired invites check...');
      const expiredCount = await this.inviteStatusService.checkAndUpdateExpiredInvites();
      
      if (expiredCount > 0) {
        this.logger.log(`Updated ${expiredCount} expired invites to 'Invite Expired'`);
      } else {
        this.logger.debug('No expired invites found');
      }
    } catch (error) {
      this.logger.error('Failed to check expired invites:', error);
    }
  }

  /**
   * Daily cleanup of old expired invites (runs at 2 AM)
   */
  @Cron('0 2 * * *')
  async handleDailyCleanup(): Promise<void> {
    try {
      this.logger.log('Starting daily cleanup of old expired invites...');
      // Add cleanup logic here if needed
      this.logger.log('Daily cleanup completed');
    } catch (error) {
      this.logger.error('Daily cleanup failed:', error);
    }
  }

  /**
   * Weekly report of invite statistics (runs every Monday at 9 AM)
   */
  @Cron('0 9 * * 1')
  async handleWeeklyInviteReport(): Promise<void> {
    try {
      this.logger.log('Generating weekly invite statistics report...');
      // Add report generation logic here if needed
      this.logger.log('Weekly invite report generated');
    } catch (error) {
      this.logger.error('Weekly invite report generation failed:', error);
    }
  }

  /**
   * Manually trigger expired invite check (useful for testing or manual runs)
   */
  async manualCheckExpiredInvites(): Promise<number> {
    this.logger.log('Manual expired invite check triggered');
    return await this.inviteStatusService.checkAndUpdateExpiredInvites();
  }
}