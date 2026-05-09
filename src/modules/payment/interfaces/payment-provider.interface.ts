/**
 * Payment provider abstraction — allows replacing PayPal with other providers
 * (Stripe, Razorpay, etc.) without touching business logic.
 */
export interface CreateSubscriptionOptions {
  planId: string;
  subscriberEmail: string;
  subscriberFirstName?: string;
  subscriberLastName?: string;
  returnUrl: string;
  cancelUrl: string;
  customId?: string;
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  approvalUrl: string;
  status: string;
}

export interface SubscriptionDetails {
  subscriptionId: string;
  status: string;
  planId: string;
  nextBillingTime?: Date;
  lastPaymentAmount?: number;
  lastPaymentCurrency?: string;
  subscriberEmail?: string;
  customId?: string;
}

export interface CreateOrderOptions {
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  customId?: string;
}

export interface CreateOrderResult {
  orderId: string;
  approvalUrl: string;
  status: string;
}

export interface CaptureOrderResult {
  orderId: string;
  captureId: string;
  status: string;
  amount: number;
  currency: string;
}

export interface IPaymentProvider {
  createSubscription(options: CreateSubscriptionOptions): Promise<CreateSubscriptionResult>;
  getSubscriptionDetails(subscriptionId: string): Promise<SubscriptionDetails>;
  cancelSubscription(subscriptionId: string, reason?: string): Promise<void>;
  createOrder(options: CreateOrderOptions): Promise<CreateOrderResult>;
  captureOrder(orderId: string): Promise<CaptureOrderResult>;
}
