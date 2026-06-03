import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '../../common/utils/email/email.module';
import { TenantModule } from '../tenant/tenant.module';
import { NotificationLog } from '../../entities/notification-log.entity';
import { User } from '../../entities/user.entity';

import { NotificationsEmailService } from './notifications-email.service';
import { NotificationsEmailListener } from './notifications-email.listener';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    TenantModule,
    TypeOrmModule.forFeature([NotificationLog, User]),
  ],
  providers: [NotificationsEmailService, NotificationsEmailListener],
  exports: [NotificationsEmailService],
})
export class NotificationsEmailModule {}
