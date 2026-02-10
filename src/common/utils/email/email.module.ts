/**
 * Email Module (common)
 * Single place for email across the project. Import this in any module that sends email.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailTemplateService, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
