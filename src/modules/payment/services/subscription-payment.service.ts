import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSubscription } from '../../../entities/payment-subscription.entity';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { SubscriptionPlan } from '../../../entities/subscription-plan.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { PayPalProvider } from '../providers/paypal.provider';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { PAYMENT_PROVIDER_PAYPAL } from '../constants/payment.constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionPaymentService {
  private readonly logger = new Logger(SubscriptionPaymentService.name);

  constructor(
    @InjectRepository(PaymentSubscription)
    private readonly subscriptionRepo: Repository<PaymentSubscription>,
    @InjectRepository(CompanyDetails)
    private readonly companyRepo: Repository<CompanyDetails>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly paypal: PayPalProvider,
    private readonly configService: ConfigService,
  ) {}

  get isPayPalConfigured(): boolean {
    return this.paypal.isConfigured;
  }

  async createSignupSubscription(
    signupSessionId: string,
    subscriberEmail: string,
    subscriberFirstName: string,
    subscriberLastName: string,
  ): Promise<{ subscriptionId: string; approvalUrl: string }> {
    const company = await this.companyRepo.findOne({
      where: { signup_session_id: signupSessionId },
    });
    if (!company) throw new BadRequestException('Company details not found');

    const plan = await this.planRepo.findOne({ where: { id: company.plan_id } });
    if (!plan) throw new BadRequestException('Subscription plan not found');

    const paypalPlanId = plan.paypal_plan_id?.trim();
    if (!paypalPlanId) {
      throw new BadRequestException(
        `Plan "${plan.name}" has no PayPal plan ID configured.`,
      );
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const returnUrl =
      this.configService.get<string>('PAYPAL_RETURN_URL') ??
      `${frontendUrl}/signup/confirm-payment`;
    const cancelUrl =
      this.configService.get<string>('PAYPAL_CANCEL_URL') ??
      `${frontendUrl}/signup/select-plan`;

    const result = await this.paypal.createSubscription({
      planId: paypalPlanId,
      subscriberEmail,
      subscriberFirstName,
      subscriberLastName,
      returnUrl: `${returnUrl}?signupSessionId=${signupSessionId}`,
      cancelUrl,
      customId: signupSessionId,
    });

    company.paypal_subscription_id = result.subscriptionId;
    company.payment_provider = PAYMENT_PROVIDER_PAYPAL;
    await this.companyRepo.save(company);

    this.logger.log(`PayPal subscription created: ${result.subscriptionId} for session ${signupSessionId}`);

    return { subscriptionId: result.subscriptionId, approvalUrl: result.approvalUrl };
  }

  async verifyAndActivateSubscription(
    signupSessionId: string,
    paypalSubscriptionId: string,
  ): Promise<{ isPaid: boolean; status: string }> {
    const company = await this.companyRepo.findOne({
      where: { signup_session_id: signupSessionId },
    });
    if (!company) throw new NotFoundException('Company details not found');

    const subId = paypalSubscriptionId || company.paypal_subscription_id;
    if (!subId) throw new BadRequestException('PayPal subscription ID is required');

    const details = await this.paypal.getSubscriptionDetails(subId);
    const isActive = [SubscriptionStatus.APPROVED, SubscriptionStatus.ACTIVE].includes(
      details.status as SubscriptionStatus,
    );

    if (isActive) {
      company.is_paid = true;
      company.paypal_subscription_id = details.subscriptionId;
      company.payment_provider = PAYMENT_PROVIDER_PAYPAL;
      await this.companyRepo.save(company);

      if (company.tenant_id) {
        await this.upsertSubscriptionRecord(company, details);
      }
    }

    this.logger.log(`Subscription ${subId} verified: status=${details.status} isPaid=${isActive}`);

    return { isPaid: isActive, status: details.status };
  }

  /**
   * Called from SignupService.completeSignup() after the tenant_id is assigned.
   * Creates the payment_subscriptions record linking the PayPal subscription to the tenant.
   */
  async registerSubscriptionForNewTenant(company: CompanyDetails): Promise<void> {
    if (!company.paypal_subscription_id || !company.tenant_id) return;

    try {
      const details = await this.paypal.getSubscriptionDetails(company.paypal_subscription_id);
      await this.upsertSubscriptionRecord(company, details);
    } catch (err) {
      this.logger.warn(
        `Could not register subscription record for tenant ${company.tenant_id}: ${(err as Error).message}`,
      );
    }
  }

  async cancelTenantSubscription(tenantId: string, reason?: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId, status: SubscriptionStatus.ACTIVE },
    });
    if (!subscription) throw new NotFoundException('Active subscription not found');

    if (!subscription.paypal_subscription_id) {
      throw new BadRequestException('No PayPal subscription ID on record');
    }

    await this.paypal.cancelSubscription(subscription.paypal_subscription_id, reason);

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelled_at = new Date();
    await this.subscriptionRepo.save(subscription);

    this.logger.log(`Subscription ${subscription.paypal_subscription_id} cancelled for tenant ${tenantId}`);
  }

  async getCurrentSubscription(tenantId: string): Promise<PaymentSubscription | null> {
    return this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }

  async findByPayPalSubscriptionId(paypalSubscriptionId: string): Promise<PaymentSubscription | null> {
    return this.subscriptionRepo.findOne({
      where: { paypal_subscription_id: paypalSubscriptionId },
    });
  }

  async updateSubscriptionStatus(
    paypalSubscriptionId: string,
    status: SubscriptionStatus,
    extra?: Partial<Pick<PaymentSubscription, 'next_billing_at' | 'cancelled_at' | 'started_at'>>,
  ): Promise<void> {
    const record = await this.subscriptionRepo.findOne({
      where: { paypal_subscription_id: paypalSubscriptionId },
    });

    if (!record) {
      this.logger.warn(`updateSubscriptionStatus: no record for PayPal subscription ${paypalSubscriptionId}`);
      return;
    }

    record.status = status;
    if (extra) Object.assign(record, extra);
    await this.subscriptionRepo.save(record);
  }

  async activateTenant(tenantId: string): Promise<void> {
    await this.tenantRepo.update({ id: tenantId }, { status: 'active' } as Partial<Tenant>);
  }

  async suspendTenantAccess(tenantId: string): Promise<void> {
    await this.tenantRepo.update({ id: tenantId }, { status: 'suspended' } as Partial<Tenant>);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async upsertSubscriptionRecord(
    company: CompanyDetails,
    details: {
      subscriptionId: string;
      status: string;
      planId: string | undefined;
      nextBillingTime?: Date;
      lastPaymentAmount?: number;
      lastPaymentCurrency?: string;
    },
  ): Promise<void> {
    if (!company.tenant_id) return;

    let record = await this.subscriptionRepo.findOne({
      where: { paypal_subscription_id: details.subscriptionId },
    });

    if (!record) {
      record = this.subscriptionRepo.create({
        tenant_id: company.tenant_id,
        paypal_subscription_id: details.subscriptionId,
        paypal_plan_id: details.planId ?? null,
        status: details.status as SubscriptionStatus,
        amount: details.lastPaymentAmount ?? null,
        currency: details.lastPaymentCurrency ?? 'USD',
        payment_provider: PAYMENT_PROVIDER_PAYPAL,
        started_at: new Date(),
        next_billing_at: details.nextBillingTime ?? null,
      });
    } else {
      record.status = details.status as SubscriptionStatus;
      record.next_billing_at = details.nextBillingTime ?? record.next_billing_at;
    }

    await this.subscriptionRepo.save(record);
  }
}
