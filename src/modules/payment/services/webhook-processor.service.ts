import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTransaction } from '../../../entities/payment-transaction.entity';
import { PaymentSubscription } from '../../../entities/payment-subscription.entity';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { PayPalProvider } from '../providers/paypal.provider';
import { SubscriptionPaymentService } from './subscription-payment.service';
import { AddonPaymentService } from './addon-payment.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentType } from '../enums/payment-type.enum';
import {
  PAYPAL_WEBHOOK_EVENTS,
  PAYMENT_PROVIDER_PAYPAL,
  PAYPAL_DEFAULT_CURRENCY,
} from '../constants/payment.constants';
import type {
  PayPalWebhookEvent,
  PayPalSubscriptionResource,
  PayPalSaleResource,
  PayPalOrderResource,
} from '../interfaces/paypal-api.interface';

type WebhookResult = { processed: boolean; eventId: string; eventType: string };

type RecordTransactionParams = {
  tenantId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentType: PaymentType;
  paypalOrderId?: string;
  webhookEventId: string;
  webhookEventType: string;
  rawResponse: unknown;
};

@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly transactionRepo: Repository<PaymentTransaction>,
    @InjectRepository(PaymentSubscription)
    private readonly subscriptionRepo: Repository<PaymentSubscription>,
    @InjectRepository(CompanyDetails)
    private readonly companyRepo: Repository<CompanyDetails>,
    private readonly paypal: PayPalProvider,
    private readonly subscriptionService: SubscriptionPaymentService,
    private readonly addonService: AddonPaymentService,
  ) {}

  async receive(
    rawBody: Record<string, unknown>,
    headers: {
      authAlgo: string;
      certUrl: string;
      transmissionId: string;
      transmissionSig: string;
      transmissionTime: string;
    },
  ): Promise<WebhookResult> {
    const isVerified = await this.paypal.verifyWebhookSignature(headers, rawBody);
    if (!isVerified) {
      throw new UnauthorizedException('PayPal webhook signature verification failed');
    }

    const event = rawBody as unknown as PayPalWebhookEvent;
    const { id: eventId, event_type: eventType } = event;

    const existing = await this.transactionRepo.findOne({ where: { webhook_event_id: eventId } });
    if (existing) {
      this.logger.log(`Webhook ${eventId} already processed — skipping`);
      return { processed: false, eventId, eventType };
    }

    this.logger.log(`Processing PayPal webhook: ${eventType} (${eventId})`);
    await this.dispatch(event);

    return { processed: true, eventId, eventType };
  }

  // ── Dispatcher ─────────────────────────────────────────────────────────────

  private async dispatch(event: PayPalWebhookEvent): Promise<void> {
    const u = event as unknown;

    switch (event.event_type) {
      case PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
        await this.onSubscriptionCreated(u as PayPalWebhookEvent<PayPalSubscriptionResource>);
        break;
      case PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_ACTIVATED:
        await this.onSubscriptionActivated(u as PayPalWebhookEvent<PayPalSubscriptionResource>);
        break;
      case PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_CANCELLED:
        await this.onSubscriptionTerminated(
          u as PayPalWebhookEvent<PayPalSubscriptionResource>,
          SubscriptionStatus.CANCELLED,
        );
        break;
      case PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_SUSPENDED:
        await this.onSubscriptionTerminated(
          u as PayPalWebhookEvent<PayPalSubscriptionResource>,
          SubscriptionStatus.SUSPENDED,
        );
        break;
      case PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_EXPIRED:
        await this.onSubscriptionTerminated(
          u as PayPalWebhookEvent<PayPalSubscriptionResource>,
          SubscriptionStatus.EXPIRED,
        );
        break;
      case PAYPAL_WEBHOOK_EVENTS.SALE_COMPLETED:
        await this.onSaleCompleted(u as PayPalWebhookEvent<PayPalSaleResource>);
        break;
      case PAYPAL_WEBHOOK_EVENTS.SALE_DENIED:
      case PAYPAL_WEBHOOK_EVENTS.SALE_REFUNDED:
        await this.onSaleEvent(u as PayPalWebhookEvent<PayPalSaleResource>);
        break;
      case PAYPAL_WEBHOOK_EVENTS.ORDER_APPROVED:
      case PAYPAL_WEBHOOK_EVENTS.ORDER_COMPLETED:
        await this.onOrderEvent(u as PayPalWebhookEvent<PayPalOrderResource>);
        break;
      default:
        this.logger.warn(`Unhandled PayPal webhook event type: ${event.event_type}`);
    }
  }

  // ── Subscription event handlers ───────────────────────────────────────────

  private async onSubscriptionCreated(
    event: PayPalWebhookEvent<PayPalSubscriptionResource>,
  ): Promise<void> {
    const { resource } = event;
    const tenantId = await this.upsertSubscriptionFromWebhook(resource, SubscriptionStatus.APPROVAL_PENDING);
    await this.recordTransaction({
      tenantId,
      amount: 0,
      currency: PAYPAL_DEFAULT_CURRENCY,
      status: PaymentStatus.PENDING,
      paymentType: PaymentType.SUBSCRIPTION,
      webhookEventId: event.id,
      webhookEventType: event.event_type,
      rawResponse: event,
    });
  }

  private async onSubscriptionActivated(
    event: PayPalWebhookEvent<PayPalSubscriptionResource>,
  ): Promise<void> {
    const { resource } = event;
    const tenantId = await this.resolveTenantAndActivate(resource);
    await this.subscriptionService.updateSubscriptionStatus(
      resource.id,
      SubscriptionStatus.ACTIVE,
      { started_at: new Date() },
    );
    await this.recordTransaction({
      tenantId,
      amount: 0,
      currency: PAYPAL_DEFAULT_CURRENCY,
      status: PaymentStatus.COMPLETED,
      paymentType: PaymentType.SUBSCRIPTION,
      webhookEventId: event.id,
      webhookEventType: event.event_type,
      rawResponse: event,
    });
  }

  /** Handles CANCELLED, SUSPENDED, and EXPIRED — identical flow, different status. */
  private async onSubscriptionTerminated(
    event: PayPalWebhookEvent<PayPalSubscriptionResource>,
    status: SubscriptionStatus.CANCELLED | SubscriptionStatus.SUSPENDED | SubscriptionStatus.EXPIRED,
  ): Promise<void> {
    const { resource } = event;
    const tenantId = await this.resolveTenantIdBySubscription(resource.id);
    if (status === SubscriptionStatus.CANCELLED) {
      await this.subscriptionService.updateSubscriptionStatus(resource.id, status, { cancelled_at: new Date() });
    } else {
      await this.subscriptionService.updateSubscriptionStatus(resource.id, status);
    }
    if (tenantId) await this.subscriptionService.suspendTenantAccess(tenantId);
    await this.recordTransaction({
      tenantId,
      amount: 0,
      currency: PAYPAL_DEFAULT_CURRENCY,
      status: PaymentStatus.FAILED,
      paymentType: PaymentType.SUBSCRIPTION,
      webhookEventId: event.id,
      webhookEventType: event.event_type,
      rawResponse: event,
    });
  }

  // ── Sale event handlers ───────────────────────────────────────────────────

  private async onSaleCompleted(event: PayPalWebhookEvent<PayPalSaleResource>): Promise<void> {
    const { resource } = event;
    const tenantId = resource.billing_agreement_id
      ? await this.resolveTenantIdBySubscription(resource.billing_agreement_id)
      : null;

    if (tenantId && resource.billing_agreement_id) {
      await this.subscriptionService.updateSubscriptionStatus(
        resource.billing_agreement_id,
        SubscriptionStatus.ACTIVE,
      );
    }

    await this.recordTransaction({
      tenantId,
      amount: parseFloat(resource.amount?.total ?? '0'),
      currency: resource.amount?.currency ?? PAYPAL_DEFAULT_CURRENCY,
      status: PaymentStatus.COMPLETED,
      paymentType: PaymentType.SUBSCRIPTION,
      webhookEventId: event.id,
      webhookEventType: event.event_type,
      rawResponse: event,
    });
  }

  /** Handles SALE_DENIED and SALE_REFUNDED — same recording logic, status differs via event type. */
  private async onSaleEvent(event: PayPalWebhookEvent<PayPalSaleResource>): Promise<void> {
    const { resource } = event;
    const tenantId = resource.billing_agreement_id
      ? await this.resolveTenantIdBySubscription(resource.billing_agreement_id)
      : null;
    const status =
      event.event_type === PAYPAL_WEBHOOK_EVENTS.SALE_REFUNDED
        ? PaymentStatus.REFUNDED
        : PaymentStatus.DENIED;

    await this.recordTransaction({
      tenantId,
      amount: parseFloat(resource.amount?.total ?? '0'),
      currency: resource.amount?.currency ?? PAYPAL_DEFAULT_CURRENCY,
      status,
      paymentType: PaymentType.SUBSCRIPTION,
      webhookEventId: event.id,
      webhookEventType: event.event_type,
      rawResponse: event,
    });
  }

  // ── Order event handler ───────────────────────────────────────────────────

  private async onOrderEvent(event: PayPalWebhookEvent<PayPalOrderResource>): Promise<void> {
    const { resource } = event;
    const addonPurchase = resource.id
      ? await this.addonService.findByPayPalOrderId(resource.id)
      : null;

    await this.recordTransaction({
      tenantId: addonPurchase?.tenant_id ?? null,
      paypalOrderId: resource.id,
      amount: 0,
      currency: PAYPAL_DEFAULT_CURRENCY,
      status: PaymentStatus.COMPLETED,
      paymentType: PaymentType.ADDON,
      webhookEventId: event.id,
      webhookEventType: event.event_type,
      rawResponse: event,
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async resolveTenantIdBySubscription(paypalSubscriptionId: string): Promise<string | null> {
    const record = await this.subscriptionService.findByPayPalSubscriptionId(paypalSubscriptionId);
    if (record) return record.tenant_id;

    const company = await this.companyRepo.findOne({
      where: { paypal_subscription_id: paypalSubscriptionId },
    });
    return company?.tenant_id ?? null;
  }

  private async resolveTenantAndActivate(resource: PayPalSubscriptionResource): Promise<string | null> {
    const tenantId = await this.resolveTenantIdBySubscription(resource.id);

    if (tenantId) {
      await this.subscriptionService.activateTenant(tenantId);
      return tenantId;
    }

    // Fallback: resolve via signup session custom_id (company not yet linked to a tenant)
    if (resource.custom_id) {
      const company = await this.companyRepo.findOne({
        where: { signup_session_id: resource.custom_id },
      });
      if (company && !company.is_paid) {
        company.is_paid = true;
        company.paypal_subscription_id = resource.id;
        company.payment_provider = PAYMENT_PROVIDER_PAYPAL;
        await this.companyRepo.save(company);
        this.logger.log(`Auto-activated company for signup session ${resource.custom_id}`);
      }
      return company?.tenant_id ?? null;
    }

    return null;
  }

  /** Creates or updates the subscription record from a webhook event. Returns the tenantId. */
  private async upsertSubscriptionFromWebhook(
    resource: PayPalSubscriptionResource,
    status: SubscriptionStatus,
  ): Promise<string | null> {
    const existing = await this.subscriptionRepo.findOne({
      where: { paypal_subscription_id: resource.id },
    });

    if (existing) {
      existing.status = status;
      await this.subscriptionRepo.save(existing);
      return existing.tenant_id;
    }

    const tenantId = await this.resolveTenantIdBySubscription(resource.id);
    if (!tenantId) return null;

    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        tenant_id: tenantId,
        paypal_subscription_id: resource.id,
        paypal_plan_id: resource.plan_id,
        status,
        payment_provider: PAYMENT_PROVIDER_PAYPAL,
      }),
    );

    return tenantId;
  }

  private async recordTransaction(params: RecordTransactionParams): Promise<void> {
    if (!params.tenantId) return;

    try {
      await this.transactionRepo.save(
        this.transactionRepo.create({
          tenant_id: params.tenantId,
          amount: params.amount,
          currency: params.currency,
          status: params.status,
          payment_type: params.paymentType,
          paypal_order_id: params.paypalOrderId ?? null,
          webhook_event_id: params.webhookEventId,
          webhook_event_type: params.webhookEventType,
          raw_response: params.rawResponse as Record<string, unknown>,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to record transaction for event ${params.webhookEventId}: ${(err as Error).message}`,
      );
    }
  }
}
