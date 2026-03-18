/**
 * Email Module
 * Centralized email functionality module
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { SendGridService } from './sendgrid.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, SendGridService],
  exports: [EmailService, SendGridService],
})
export class EmailModule {}
