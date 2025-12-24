import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingTransaction } from '../../entities/billing-transaction.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { BillingService } from './services/billing.service';
import { BillingListener } from './listeners/billing.listener';
import { BillingController } from './controllers/billing.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingTransaction, CompanyDetails]),
    SharedJwtModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, BillingListener],
  exports: [BillingService],
})
export class BillingModule {}

