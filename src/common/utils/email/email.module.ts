/**
 * Email Module (common)
 * Single place for email across the project. Import this in any module that sends email.
 */

import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailTemplateService, EmailService],
  exports: [EmailService, EmailTemplateService],
})
export class EmailModule {}
