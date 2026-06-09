import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '../constants/enums';

@Injectable()
export class PaymentProviderService {
  constructor(private readonly configService: ConfigService) {}

  getProvider(): PaymentProvider {
    const raw = this.configService.get<string>('PAYMENT_PROVIDER', 'stripe');
    return raw === PaymentProvider.PAYPAL
      ? PaymentProvider.PAYPAL
      : PaymentProvider.STRIPE;
  }

  isPayPal(): boolean {
    return this.getProvider() === PaymentProvider.PAYPAL;
  }

  isStripe(): boolean {
    return this.getProvider() === PaymentProvider.STRIPE;
  }
}
