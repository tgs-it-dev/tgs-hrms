import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  IPaymentProvider,
  CreateSubscriptionOptions,
  CreateSubscriptionResult,
  SubscriptionDetails,
  CreateOrderOptions,
  CreateOrderResult,
  CaptureOrderResult,
} from '../interfaces/payment-provider.interface';
import {
  PayPalTokenResponse,
  PayPalSubscriptionRequest,
  PayPalSubscriptionResponse,
  PayPalOrderRequest,
  PayPalOrderResponse,
  PayPalCaptureResponse,
  PayPalWebhookVerifyRequest,
  PayPalWebhookVerifyResponse,
  PayPalApiError,
} from '../interfaces/paypal-api.interface';
import { PAYPAL_API_BASE, PAYPAL_TOKEN_EXPIRY_BUFFER_SECONDS } from '../constants/payment.constants';
import { PayPalEnvironment } from '../config/paypal.config';

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class PayPalProvider implements IPaymentProvider {
  private readonly logger = new Logger(PayPalProvider.name);
  private readonly http: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;
  private cachedToken: CachedToken | null = null;

  constructor(private readonly configService: ConfigService) {
    const env = this.configService.get<string>('PAYPAL_ENV', PayPalEnvironment.SANDBOX);
    const baseURL =
      env === PayPalEnvironment.PRODUCTION
        ? PAYPAL_API_BASE.production
        : PAYPAL_API_BASE.sandbox;

    this.clientId = this.configService.get<string>('PAYPAL_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET', '');
    this.webhookId = this.configService.get<string>('PAYPAL_WEBHOOK_ID', '');

    this.http = axios.create({
      baseURL,
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  // ── OAuth token management ────────────────────────────────────────────────

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await this.http.post<PayPalTokenResponse>(
        '/v1/oauth2/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const { access_token, expires_in } = response.data;
      this.cachedToken = {
        token: access_token,
        expiresAt: Date.now() + (expires_in - PAYPAL_TOKEN_EXPIRY_BUFFER_SECONDS) * 1000,
      };

      return access_token;
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<PayPalApiError>;
      const status = axiosErr.response?.status;
      const rawData = axiosErr.response?.data as Record<string, unknown> | undefined;
      const detail = (axiosErr.response?.data?.message ?? rawData?.['error_description'] ?? axiosErr.message) as string;
      this.logger.error(`PayPal OAuth token request failed HTTP ${status ?? 'N/A'}: ${detail}`);

      if (status === 401) {
        throw new ServiceUnavailableException(
          'PayPal credentials are invalid or do not match the configured environment (sandbox vs production). Check PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_ENV in your .env file.',
        );
      }
      throw new ServiceUnavailableException(`PayPal authentication failed: ${detail}`);
    }
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  async createSubscription(options: CreateSubscriptionOptions): Promise<CreateSubscriptionResult> {
    this.assertConfigured();

    const body: PayPalSubscriptionRequest = {
      plan_id: options.planId,
      subscriber: {
        name: {
          given_name: options.subscriberFirstName,
          surname: options.subscriberLastName,
        },
        email_address: options.subscriberEmail,
      },
      application_context: {
        brand_name: 'TGS HRMS',
        locale: 'en-US',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
        },
        return_url: options.returnUrl,
        cancel_url: options.cancelUrl,
      },
      custom_id: options.customId,
    };

    const response = await this.request<PayPalSubscriptionResponse>(
      'POST',
      '/v1/billing/subscriptions',
      body,
    );

    const approvalLink = response.links.find((l) => l.rel === 'approve');
    if (!approvalLink) {
      throw new ServiceUnavailableException('PayPal did not return an approval URL');
    }

    return {
      subscriptionId: response.id,
      approvalUrl: approvalLink.href,
      status: response.status,
    };
  }

  async getSubscriptionDetails(subscriptionId: string): Promise<SubscriptionDetails> {
    this.assertConfigured();

    const response = await this.request<PayPalSubscriptionResponse>(
      'GET',
      `/v1/billing/subscriptions/${subscriptionId}`,
    );

    const lastPayment = response.billing_info?.last_payment;
    const nextBilling = response.billing_info?.next_billing_time;

    return {
      subscriptionId: response.id,
      status: response.status,
      planId: response.plan_id,
      nextBillingTime: nextBilling ? new Date(nextBilling) : undefined,
      lastPaymentAmount: lastPayment ? parseFloat(lastPayment.amount.value) : undefined,
      lastPaymentCurrency: lastPayment?.amount.currency_code,
      subscriberEmail: response.subscriber?.email_address,
      customId: response.custom_id,
    };
  }

  async cancelSubscription(subscriptionId: string, reason = 'Customer requested cancellation'): Promise<void> {
    this.assertConfigured();

    await this.request<void>(
      'POST',
      `/v1/billing/subscriptions/${subscriptionId}/cancel`,
      { reason },
    );
  }

  // ── Orders (one-time payments) ────────────────────────────────────────────

  async createOrder(options: CreateOrderOptions): Promise<CreateOrderResult> {
    this.assertConfigured();

    const body: PayPalOrderRequest = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: options.description,
          custom_id: options.customId,
          amount: {
            currency_code: options.currency,
            value: options.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'TGS HRMS',
        locale: 'en-US',
        user_action: 'PAY_NOW',
        return_url: options.returnUrl,
        cancel_url: options.cancelUrl,
      },
    };

    const response = await this.request<PayPalOrderResponse>(
      'POST',
      '/v2/checkout/orders',
      body,
    );

    const approvalLink = response.links.find((l) => l.rel === 'approve');
    if (!approvalLink) {
      throw new ServiceUnavailableException('PayPal did not return an approval URL for the order');
    }

    return {
      orderId: response.id,
      approvalUrl: approvalLink.href,
      status: response.status,
    };
  }

  async captureOrder(orderId: string): Promise<CaptureOrderResult> {
    this.assertConfigured();

    const response = await this.request<PayPalCaptureResponse>(
      'POST',
      `/v2/checkout/orders/${orderId}/capture`,
      {},
    );

    const capture = response.purchase_units[0]?.payments?.captures?.[0];
    if (!capture) {
      throw new ServiceUnavailableException('PayPal capture response missing capture details');
    }

    return {
      orderId: response.id,
      captureId: capture.id,
      status: capture.status,
      amount: parseFloat(capture.amount.value),
      currency: capture.amount.currency_code,
    };
  }

  // ── Webhook verification ──────────────────────────────────────────────────

  async verifyWebhookSignature(
    headers: {
      authAlgo: string;
      certUrl: string;
      transmissionId: string;
      transmissionSig: string;
      transmissionTime: string;
    },
    rawBody: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this.webhookId) {
      this.logger.warn('PAYPAL_WEBHOOK_ID not set — skipping webhook signature verification');
      return true;
    }

    try {
      const payload: PayPalWebhookVerifyRequest = {
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: this.webhookId,
        webhook_event: rawBody,
      };

      const response = await this.request<PayPalWebhookVerifyResponse>(
        'POST',
        '/v1/notifications/verify-webhook-signature',
        payload,
      );

      return response.verification_status === 'VERIFIED';
    } catch (err) {
      this.logger.error(`Webhook verification call failed: ${String(err instanceof Error ? err.message : err)}`);
      return false;
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
      );
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, data?: unknown): Promise<T> {
    const headers = await this.authHeaders();

    try {
      const response = await this.http.request<T>({
        method,
        url: path,
        data,
        headers,
      });
      return response.data;
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<PayPalApiError>;
      const paypalMsg =
        axiosErr.response?.data?.message ??
        axiosErr.response?.data?.name ??
        axiosErr.message;

      const status = axiosErr.response?.status;
      this.logger.error(
        `PayPal API error [${method} ${path}] HTTP ${status ?? 'N/A'}: ${paypalMsg}`,
        axiosErr.response?.data,
      );

      throw new ServiceUnavailableException(`PayPal API error: ${paypalMsg}`);
    }
  }
}
