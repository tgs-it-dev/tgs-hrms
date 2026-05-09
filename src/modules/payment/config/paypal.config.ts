import { registerAs } from '@nestjs/config';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PayPalEnvironment {
  SANDBOX = 'sandbox',
  PRODUCTION = 'production',
}

export class PayPalConfig {
  @IsString()
  clientId: string;

  @IsString()
  clientSecret: string;

  @IsEnum(PayPalEnvironment)
  environment: PayPalEnvironment;

  @IsString()
  @IsOptional()
  webhookId?: string;

  @IsString()
  @IsOptional()
  basicPlanId?: string;

  @IsString()
  @IsOptional()
  proPlanId?: string;

  @IsString()
  @IsOptional()
  enterprisePlanId?: string;

  @IsString()
  @IsOptional()
  returnUrl?: string;

  @IsString()
  @IsOptional()
  cancelUrl?: string;
}

export const paypalConfig = registerAs('paypal', (): PayPalConfig => ({
  clientId: process.env.PAYPAL_CLIENT_ID ?? '',
  clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
  environment: (process.env.PAYPAL_ENV as PayPalEnvironment) ?? PayPalEnvironment.SANDBOX,
  webhookId: process.env.PAYPAL_WEBHOOK_ID,
  basicPlanId: process.env.PAYPAL_BASIC_PLAN_ID,
  proPlanId: process.env.PAYPAL_PRO_PLAN_ID,
  enterprisePlanId: process.env.PAYPAL_ENTERPRISE_PLAN_ID,
  returnUrl: process.env.PAYPAL_RETURN_URL,
  cancelUrl: process.env.PAYPAL_CANCEL_URL,
}));
