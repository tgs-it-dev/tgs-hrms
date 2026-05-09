import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingTransaction } from '../../entities/billing-transaction.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Tenant } from '../../entities/tenant.entity';
import { BillingService } from './services/billing.service';
import { BillingListener } from './listeners/billing.listener';
import { BillingController } from './controllers/billing.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TenantModule } from '../tenant/tenant.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingTransaction, CompanyDetails, Tenant]),
    SharedJwtModule,
    TenantModule,
    PaymentModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, BillingListener],
  exports: [BillingService],
})
export class BillingModule {}
