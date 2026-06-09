export interface PaypalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface PaypalSubscriptionLink {
  href: string;
  rel: string;
  method: string;
}

export interface PaypalCreateSubscriptionResponse {
  id: string;
  status: string;
  links: PaypalSubscriptionLink[];
}

export interface PaypalSubscriberName {
  given_name?: string;
  surname?: string;
}

export interface PaypalSubscriber {
  name?: PaypalSubscriberName;
  email_address?: string;
  payer_id?: string;
}

export interface PaypalBillingInfo {
  outstanding_balance?: { currency_code: string; value: string };
  cycle_executions?: Array<{
    tenure_type: string;
    sequence: number;
    cycles_completed: number;
    cycles_remaining: number;
    total_cycles: number;
  }>;
  last_payment?: {
    amount: { currency_code: string; value: string };
    time: string;
  };
  next_billing_time?: string;
  failed_payments_count?: number;
}

export interface PaypalSubscriptionDetails {
  id: string;
  plan_id: string;
  status: string;
  custom_id?: string;
  subscriber?: PaypalSubscriber;
  billing_info?: PaypalBillingInfo;
  create_time?: string;
  update_time?: string;
  links?: PaypalSubscriptionLink[];
}

export interface PaypalWebhookResource {
  id: string;
  plan_id?: string;
  status?: string;
  custom_id?: string;
  subscriber?: PaypalSubscriber;
  billing_info?: PaypalBillingInfo;
}

export interface PaypalWebhookPayload {
  id: string;
  event_type: string;
  resource_type: string;
  resource: PaypalWebhookResource;
  create_time: string;
}

export interface PaypalWebhookVerifyRequest {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  webhook_event: PaypalWebhookPayload;
}

export interface PaypalWebhookVerifyResponse {
  verification_status: 'SUCCESS' | 'FAILURE';
}
