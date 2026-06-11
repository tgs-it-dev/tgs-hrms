import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaypalController } from './paypal.controller';
import { PaypalService } from './services/paypal.service';
import { PaypalWebhookService } from './services/paypal-webhook.service';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Tenant } from '../../entities/tenant.entity';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { SignupSession } from '../../entities/signup-session.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      CompanyDetails,
      Tenant,
      SubscriptionPlan,
      SignupSession,
    ]),
  ],
  controllers: [PaypalController],
  providers: [PaypalService, PaypalWebhookService],
  exports: [PaypalService],
})
export class PaypalModule {}
