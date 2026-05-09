import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { paypalConfig } from './config/paypal.config';
import { SharedJwtModule } from '../../common/modules/jwt.module';

// Entities
import { PaymentSubscription } from '../../entities/payment-subscription.entity';
import { PaymentTransaction } from '../../entities/payment-transaction.entity';
import { AddonPurchase } from '../../entities/addon-purchase.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { Tenant } from '../../entities/tenant.entity';

// Provider
import { PayPalProvider } from './providers/paypal.provider';

// Services
import { SubscriptionPaymentService } from './services/subscription-payment.service';
import { AddonPaymentService } from './services/addon-payment.service';
import { WebhookProcessorService } from './services/webhook-processor.service';

// Controllers
import { SubscriptionController } from './controllers/subscription.controller';
import { AddonController } from './controllers/addon.controller';
import { WebhookController } from './controllers/webhook.controller';

@Module({
  imports: [
    ConfigModule.forFeature(paypalConfig),
    SharedJwtModule,
    TypeOrmModule.forFeature([
      PaymentSubscription,
      PaymentTransaction,
      AddonPurchase,
      CompanyDetails,
      SubscriptionPlan,
      Tenant,
    ]),
  ],
  controllers: [
    SubscriptionController,
    AddonController,
    WebhookController,
  ],
  providers: [
    PayPalProvider,
    SubscriptionPaymentService,
    AddonPaymentService,
    WebhookProcessorService,
  ],
  exports: [
    PayPalProvider,
    SubscriptionPaymentService,
    AddonPaymentService,
  ],
})
export class PaymentModule {}
