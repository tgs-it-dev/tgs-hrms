import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { Tenant } from '../../../entities/tenant.entity';
import {
  PaypalWebhookEvent,
  SubscriptionStatus,
} from '../../../common/constants/enums';
import { PaypalWebhookResource } from '../interfaces/paypal.interfaces';

const GRACE_PERIOD_DAYS = 7;

@Injectable()
export class PaypalWebhookService {
  private readonly logger = new Logger(PaypalWebhookService.name);

  constructor(
    @InjectRepository(CompanyDetails)
    private readonly companyDetailsRepo: Repository<CompanyDetails>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async handleEvent(
    eventType: string,
    resource: PaypalWebhookResource,
  ): Promise<void> {
    this.logger.log(`PayPal webhook received: ${eventType}`);

    switch (eventType) {
      case PaypalWebhookEvent.SUBSCRIPTION_ACTIVATED:
        await this.onSubscriptionActivated(resource);
        break;

      case PaypalWebhookEvent.SUBSCRIPTION_CANCELLED:
        await this.onSubscriptionStatusChange(
          resource,
          SubscriptionStatus.CANCELLED,
        );
        break;

      case PaypalWebhookEvent.SUBSCRIPTION_EXPIRED:
        await this.onSubscriptionStatusChange(
          resource,
          SubscriptionStatus.EXPIRED,
        );
        break;

      case PaypalWebhookEvent.SUBSCRIPTION_SUSPENDED:
      case PaypalWebhookEvent.SUBSCRIPTION_PAYMENT_FAILED:
        await this.onSubscriptionSuspendedOrFailed(resource);
        break;

      case PaypalWebhookEvent.PAYMENT_SALE_COMPLETED:
        // Subscription renewed — ensure status stays ACTIVE.
        await this.onPaymentSaleCompleted(resource);
        break;

      default:
        this.logger.debug(`Unhandled PayPal event type: ${eventType}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Private handlers
  // ---------------------------------------------------------------------------

  private async onSubscriptionActivated(
    resource: PaypalWebhookResource,
  ): Promise<void> {
    const tenantId = resource.custom_id;
    if (!tenantId) {
      this.logger.warn('SUBSCRIPTION_ACTIVATED: missing custom_id (tenantId)');
      return;
    }

    await this.tenantRepo.update(
      { id: tenantId },
      {
        subscription_status: SubscriptionStatus.ACTIVE,
        trial_ends_at: null,
        grace_period_ends_at: null,
      },
    );

    await this.companyDetailsRepo.update(
      { tenant_id: tenantId },
      {
        paypal_subscription_id: resource.id,
        paypal_payer_id: resource.subscriber?.payer_id ?? null,
        is_paid: true,
      },
    );

    this.logger.log(`Tenant ${tenantId} activated via PayPal (${resource.id})`);
  }

  private async onSubscriptionStatusChange(
    resource: PaypalWebhookResource,
    newStatus: SubscriptionStatus,
  ): Promise<void> {
    const tenantId = await this.resolveTenantId(resource);
    if (!tenantId) return;

    await this.tenantRepo.update(
      { id: tenantId },
      { subscription_status: newStatus },
    );

    this.logger.log(
      `Tenant ${tenantId} subscription changed to ${newStatus} (${resource.id})`,
    );
  }

  private async onSubscriptionSuspendedOrFailed(
    resource: PaypalWebhookResource,
  ): Promise<void> {
    const tenantId = await this.resolveTenantId(resource);
    if (!tenantId) return;

    const gracePeriodEndsAt = new Date(
      Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.tenantRepo.update(
      { id: tenantId },
      {
        subscription_status: SubscriptionStatus.GRACE_PERIOD,
        grace_period_ends_at: gracePeriodEndsAt,
      },
    );

    this.logger.log(
      `Tenant ${tenantId} entered grace period until ${gracePeriodEndsAt.toISOString()} (${resource.id})`,
    );
  }

  private async onPaymentSaleCompleted(
    resource: PaypalWebhookResource,
  ): Promise<void> {
    // resource for PAYMENT.SALE.COMPLETED doesn't have custom_id directly;
    // resolve via paypal_subscription_id stored in company_details.
    const subscriptionId = (resource as unknown as Record<string, string>)
      .billing_agreement_id;
    if (!subscriptionId) return;

    const company = await this.companyDetailsRepo.findOne({
      where: { paypal_subscription_id: subscriptionId },
    });
    if (!company?.tenant_id) return;

    await this.tenantRepo.update(
      { id: company.tenant_id },
      {
        subscription_status: SubscriptionStatus.ACTIVE,
        grace_period_ends_at: null,
      },
    );

    this.logger.log(
      `Tenant ${company.tenant_id} payment confirmed for subscription ${subscriptionId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async resolveTenantId(
    resource: PaypalWebhookResource,
  ): Promise<string | null> {
    // Prefer custom_id (set at subscription creation time).
    if (resource.custom_id) return resource.custom_id;

    // Fall back to looking up via stored subscription ID.
    const company = await this.companyDetailsRepo.findOne({
      where: { paypal_subscription_id: resource.id },
    });

    if (!company?.tenant_id) {
      this.logger.warn(
        `Could not resolve tenant for PayPal subscription ${resource.id}`,
      );
      return null;
    }

    return company.tenant_id;
  }
}
