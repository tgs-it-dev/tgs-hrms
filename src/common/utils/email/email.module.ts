import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import {
  EMAIL_TRANSACTIONAL_QUEUE,
  EMAIL_BULK_QUEUE,
} from './constants/email-queue.constants';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface';
import { EmailService } from './email.service';
import { SendGridService } from './sendgrid.service';
import { EmailThrottleService } from './email-throttle.service';
import {
  TransactionalEmailProcessor,
  BulkEmailProcessor,
} from './email.processor';

@Module({
  imports: [
    ConfigModule,

    /**
     * Shared BullMQ Redis connection — all queues in this module reuse it.
     * BullMQ internally uses ioredis; `maxRetriesPerRequest: null` is required
     * for blocking commands used by workers.
     */
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
          db: config.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: null,
        },
      }),
    }),

    /**
     * Transactional queue: global rate limiter = EMAIL_TRANSACTIONAL_RPS emails/sec.
     * BullMQ's limiter pauses workers automatically when the window is full.
     */
    BullModule.registerQueueAsync({
      name: EMAIL_TRANSACTIONAL_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultJobOptions: {
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 500 },
        },
        limiter: {
          max: config.get<number>('EMAIL_TRANSACTIONAL_RPS', 10),
          duration: 1_000,
        },
      }),
    }),

    /**
     * Bulk queue: stricter global rate limiter — bulk sends are intentionally slow.
     */
    BullModule.registerQueueAsync({
      name: EMAIL_BULK_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
        limiter: {
          max: config.get<number>('EMAIL_BULK_RPS', 3),
          duration: 1_000,
        },
      }),
    }),
  ],

  providers: [
    // Bind SendGridService to the IEmailProvider token so processors and
    // other consumers depend on the interface, not the concrete class.
    // Swap this for SesProvider or SmtpProvider with zero callers changed.
    {
      provide: EMAIL_PROVIDER,
      useClass: SendGridService,
    },

    SendGridService,
    EmailService,
    EmailThrottleService,
    TransactionalEmailProcessor,
    BulkEmailProcessor,
  ],

  exports: [EmailService, SendGridService],
})
export class EmailModule {}
