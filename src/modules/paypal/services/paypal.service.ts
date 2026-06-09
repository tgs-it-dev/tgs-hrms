import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  PaypalCreateSubscriptionResponse,
  PaypalSubscriptionDetails,
  PaypalTokenResponse,
  PaypalWebhookPayload,
  PaypalWebhookVerifyRequest,
  PaypalWebhookVerifyResponse,
} from '../interfaces/paypal.interfaces';

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly client: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {
    const mode = this.configService.get<string>('PAYPAL_MODE', 'sandbox');
    const baseURL =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    this.clientId = this.configService.get<string>('PAYPAL_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>(
      'PAYPAL_CLIENT_SECRET',
      '',
    );
    this.webhookId = this.configService.get<string>('PAYPAL_WEBHOOK_ID', '');

    this.client = axios.create({ baseURL, timeout: 15_000 });

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    try {
      const { data } = await this.client.post<PaypalTokenResponse>(
        '/v1/oauth2/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      // Cache with a 60-second safety buffer before actual expiry.
      this.cachedToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

      return data.access_token;
    } catch (error) {
      const detail = this.extractErrorDetail(error);
      this.logger.error(`PayPal auth token request failed — ${detail}`);
      throw new InternalServerErrorException(
        'Could not authenticate with PayPal. Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET and network connectivity.',
      );
    }
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  async createSubscription(
    paypalPlanId: string,
    tenantId: string,
    subscriberEmail: string,
    returnUrl: string,
    cancelUrl: string,
  ): Promise<{ subscriptionId: string; approvalUrl: string }> {
    const headers = await this.authHeaders();

    const payload = {
      plan_id: paypalPlanId,
      custom_id: tenantId,
      subscriber: { email_address: subscriberEmail },
      application_context: {
        brand_name: 'TGS HRMS',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        // BILLING landing page shows the card/debit form directly without
        // requiring a PayPal account login, enabling guest card checkout.
        landing_page: 'BILLING',
        payment_method: {
          payer_selected: 'PAYPAL',
          // UNRESTRICTED allows cards, debit, and PayPal balance —
          // not just instant PayPal-funded payments.
          payee_preferred: 'UNRESTRICTED',
        },
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    try {
      const { data } = await this.client.post<PaypalCreateSubscriptionResponse>(
        '/v1/billing/subscriptions',
        payload,
        { headers },
      );

      const approveLink = data.links.find((l) => l.rel === 'approve');
      if (!approveLink) {
        throw new InternalServerErrorException(
          'PayPal did not return an approval URL',
        );
      }

      return { subscriptionId: data.id, approvalUrl: approveLink.href };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      const detail = this.extractErrorDetail(error);
      this.logger.error(`Failed to create PayPal subscription — ${detail}`);
      throw new InternalServerErrorException(
        'Failed to initiate PayPal subscription',
      );
    }
  }

  async getSubscription(
    subscriptionId: string,
  ): Promise<PaypalSubscriptionDetails> {
    const headers = await this.authHeaders();

    try {
      const { data } = await this.client.get<PaypalSubscriptionDetails>(
        `/v1/billing/subscriptions/${subscriptionId}`,
        { headers },
      );
      return data;
    } catch (error) {
      const detail = this.extractErrorDetail(error);
      this.logger.error(
        `Failed to fetch PayPal subscription ${subscriptionId} — ${detail}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve PayPal subscription',
      );
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    reason: string = 'Cancelled by user',
  ): Promise<void> {
    const headers = await this.authHeaders();

    try {
      await this.client.post(
        `/v1/billing/subscriptions/${subscriptionId}/cancel`,
        { reason },
        { headers },
      );
    } catch (error) {
      const detail = this.extractErrorDetail(error);
      this.logger.error(
        `Failed to cancel PayPal subscription ${subscriptionId} — ${detail}`,
      );
      throw new InternalServerErrorException(
        'Failed to cancel PayPal subscription',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private extractErrorDetail(error: unknown): string {
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      const code = typeof e['code'] === 'string' ? e['code'] : null;
      const message = typeof e['message'] === 'string' ? e['message'] : null;
      // Axios network-level error (ENOTFOUND, ECONNREFUSED, etc.)
      if (code && message) return `${code}: ${message}`;
      // Axios HTTP error — PayPal returned a 4xx/5xx body
      const response = e['response'] as Record<string, unknown> | undefined;
      if (response) {
        const status =
          typeof response['status'] === 'number'
            ? String(response['status'])
            : 'unknown';
        const data = JSON.stringify(response['data'] ?? null);
        return `HTTP ${status}: ${data}`;
      }
      if (message) return message;
    }
    return typeof error === 'string' ? error : 'Unknown error';
  }

  // ---------------------------------------------------------------------------
  // Webhook verification
  // ---------------------------------------------------------------------------

  async verifyWebhookSignature(
    transmissionId: string,
    transmissionTime: string,
    transmissionSig: string,
    certUrl: string,
    authAlgo: string,
    rawBody: Buffer,
  ): Promise<boolean> {
    if (!this.webhookId) {
      this.logger.warn(
        'PAYPAL_WEBHOOK_ID not configured — skipping signature verification.',
      );
      return false;
    }

    const headers = await this.authHeaders();

    let webhookEvent: PaypalWebhookPayload;
    try {
      webhookEvent = JSON.parse(rawBody.toString()) as PaypalWebhookPayload;
    } catch {
      return false;
    }

    const body: PaypalWebhookVerifyRequest = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: this.webhookId,
      webhook_event: webhookEvent,
    };

    try {
      const { data } = await this.client.post<PaypalWebhookVerifyResponse>(
        '/v1/notifications/verify-webhook-signature',
        body,
        { headers },
      );
      return data.verification_status === 'SUCCESS';
    } catch (error) {
      this.logger.error('PayPal webhook signature verification failed', error);
      return false;
    }
  }
}
