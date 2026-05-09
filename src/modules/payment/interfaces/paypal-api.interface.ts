export interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface PayPalLink {
  href: string;
  rel: string;
  method?: string;
}

export interface PayPalSubscriptionRequest {
  plan_id: string;
  subscriber?: {
    name?: { given_name?: string; surname?: string };
    email_address?: string;
  };
  application_context?: {
    brand_name?: string;
    locale?: string;
    user_action?: 'SUBSCRIBE_NOW' | 'CONTINUE';
    payment_method?: {
      payer_selected?: string;
      payee_preferred?: string;
    };
    return_url: string;
    cancel_url: string;
  };
  custom_id?: string;
}

export interface PayPalSubscriptionResponse {
  id: string;
  status: string;
  plan_id: string;
  start_time?: string;
  quantity?: string;
  shipping_amount?: { currency_code: string; value: string };
  subscriber?: {
    name?: { given_name?: string; surname?: string };
    email_address?: string;
    payer_id?: string;
  };
  billing_info?: {
    outstanding_balance?: { currency_code: string; value: string };
    cycle_executions?: Array<{
      tenure_type: string;
      sequence: number;
      cycles_completed: number;
      cycles_remaining: number;
      total_cycles: number;
    }>;
    last_payment?: { amount: { currency_code: string; value: string }; time: string };
    next_billing_time?: string;
    failed_payments_count?: number;
  };
  create_time?: string;
  update_time?: string;
  links: PayPalLink[];
  custom_id?: string;
}

export interface PayPalOrderRequest {
  intent: 'CAPTURE' | 'AUTHORIZE';
  purchase_units: Array<{
    reference_id?: string;
    description?: string;
    custom_id?: string;
    amount: { currency_code: string; value: string };
  }>;
  application_context?: {
    brand_name?: string;
    locale?: string;
    landing_page?: string;
    user_action?: 'PAY_NOW' | 'CONTINUE';
    return_url: string;
    cancel_url: string;
  };
}

export interface PayPalOrderResponse {
  id: string;
  status: string;
  links: PayPalLink[];
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
        create_time: string;
        update_time: string;
      }>;
    };
  }>;
}

export interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    reference_id?: string;
    custom_id?: string;
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
        create_time: string;
        update_time: string;
      }>;
    };
  }>;
  links: PayPalLink[];
}

export interface PayPalWebhookVerifyRequest {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  webhook_event: Record<string, unknown>;
}

export interface PayPalWebhookVerifyResponse {
  verification_status: 'VERIFIED' | 'FAILURE';
}

export interface PayPalWebhookEvent<T = Record<string, unknown>> {
  id: string;
  event_type: string;
  event_version?: string;
  create_time: string;
  resource_type?: string;
  summary?: string;
  resource: T;
  links?: PayPalLink[];
}

export interface PayPalSubscriptionResource {
  id: string;
  status: string;
  plan_id: string;
  custom_id?: string;
  billing_info?: {
    last_payment?: { amount: { currency_code: string; value: string }; time: string };
    next_billing_time?: string;
  };
}

export interface PayPalSaleResource {
  id: string;
  state: string;
  amount: { total: string; currency: string };
  billing_agreement_id?: string;
  custom?: string;
  create_time?: string;
  update_time?: string;
}

export interface PayPalOrderResource {
  id: string;
  status: string;
  purchase_units?: Array<{ custom_id?: string }>;
}

export interface PayPalApiError {
  name: string;
  message: string;
  debug_id?: string;
  details?: Array<{ issue: string; description: string }>;
}
