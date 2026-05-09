import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { PayPalProvider } from '../providers/paypal.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockCreate = jest.fn();
mockedAxios.create = jest.fn().mockReturnValue({ request: mockCreate, post: mockCreate });

describe('PayPalProvider', () => {
  let provider: PayPalProvider;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayPalProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              const map: Record<string, string> = {
                PAYPAL_CLIENT_ID: 'test-client-id',
                PAYPAL_CLIENT_SECRET: 'test-client-secret',
                PAYPAL_ENV: 'sandbox',
                PAYPAL_WEBHOOK_ID: 'test-webhook-id',
              };
              return map[key] ?? def ?? '';
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<PayPalProvider>(PayPalProvider);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('isConfigured', () => {
    it('returns true when credentials are set', () => {
      expect(provider.isConfigured).toBe(true);
    });

    it('returns false when client ID is empty', () => {
      jest.spyOn(configService, 'get').mockReturnValue('');
      const unconfigured = new PayPalProvider(configService);
      expect(unconfigured.isConfigured).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('fetches and caches a new token', async () => {
      mockCreate.mockResolvedValueOnce({
        data: { access_token: 'token-abc', expires_in: 3600 },
      });

      const token = await provider.getAccessToken();
      expect(token).toBe('token-abc');

      // Second call should use cache — no additional HTTP request
      const tokenCached = await provider.getAccessToken();
      expect(tokenCached).toBe('token-abc');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('createSubscription', () => {
    it('returns subscriptionId and approvalUrl', async () => {
      // Token fetch
      mockCreate.mockResolvedValueOnce({
        data: { access_token: 'tok', expires_in: 3600 },
      });
      // Subscription creation
      mockCreate.mockResolvedValueOnce({
        data: {
          id: 'I-SUB123',
          status: 'APPROVAL_PENDING',
          plan_id: 'P-PLAN123',
          links: [
            { rel: 'approve', href: 'https://paypal.com/approve/I-SUB123', method: 'GET' },
          ],
        },
      });

      const result = await provider.createSubscription({
        planId: 'P-PLAN123',
        subscriberEmail: 'user@example.com',
        returnUrl: 'https://app.com/return',
        cancelUrl: 'https://app.com/cancel',
      });

      expect(result.subscriptionId).toBe('I-SUB123');
      expect(result.approvalUrl).toBe('https://paypal.com/approve/I-SUB123');
      expect(result.status).toBe('APPROVAL_PENDING');
    });

    it('throws when PayPal returns no approval link', async () => {
      mockCreate.mockResolvedValueOnce({
        data: { access_token: 'tok', expires_in: 3600 },
      });
      mockCreate.mockResolvedValueOnce({
        data: { id: 'I-SUB123', status: 'APPROVAL_PENDING', links: [] },
      });

      await expect(
        provider.createSubscription({
          planId: 'P-PLAN123',
          subscriberEmail: 'user@example.com',
          returnUrl: 'https://app.com/return',
          cancelUrl: 'https://app.com/cancel',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('getSubscriptionDetails', () => {
    it('maps PayPal response to SubscriptionDetails', async () => {
      mockCreate.mockResolvedValueOnce({
        data: { access_token: 'tok', expires_in: 3600 },
      });
      mockCreate.mockResolvedValueOnce({
        data: {
          id: 'I-SUB123',
          status: 'ACTIVE',
          plan_id: 'P-PLAN123',
          subscriber: { email_address: 'user@example.com' },
          billing_info: {
            next_billing_time: '2026-06-09T00:00:00Z',
            last_payment: { amount: { currency_code: 'USD', value: '29.99' }, time: '2026-05-09T00:00:00Z' },
          },
          custom_id: 'session-abc',
          links: [],
        },
      });

      const details = await provider.getSubscriptionDetails('I-SUB123');

      expect(details.subscriptionId).toBe('I-SUB123');
      expect(details.status).toBe('ACTIVE');
      expect(details.lastPaymentAmount).toBe(29.99);
      expect(details.subscriberEmail).toBe('user@example.com');
      expect(details.customId).toBe('session-abc');
    });
  });

  describe('createOrder', () => {
    it('returns orderId and approvalUrl', async () => {
      mockCreate.mockResolvedValueOnce({
        data: { access_token: 'tok', expires_in: 3600 },
      });
      mockCreate.mockResolvedValueOnce({
        data: {
          id: 'ORDER-123',
          status: 'CREATED',
          links: [{ rel: 'approve', href: 'https://paypal.com/order/approve', method: 'GET' }],
        },
      });

      const result = await provider.createOrder({
        amount: 2.0,
        currency: 'USD',
        description: 'Employee slot',
        returnUrl: 'https://app.com/return',
        cancelUrl: 'https://app.com/cancel',
      });

      expect(result.orderId).toBe('ORDER-123');
      expect(result.approvalUrl).toContain('paypal.com');
    });
  });

  describe('captureOrder', () => {
    it('returns captureId and amount', async () => {
      mockCreate.mockResolvedValueOnce({
        data: { access_token: 'tok', expires_in: 3600 },
      });
      mockCreate.mockResolvedValueOnce({
        data: {
          id: 'ORDER-123',
          status: 'COMPLETED',
          links: [],
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAP-456',
                    status: 'COMPLETED',
                    amount: { currency_code: 'USD', value: '2.00' },
                    create_time: '2026-05-09T00:00:00Z',
                    update_time: '2026-05-09T00:00:00Z',
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await provider.captureOrder('ORDER-123');

      expect(result.captureId).toBe('CAP-456');
      expect(result.amount).toBe(2.0);
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns true when PayPal responds VERIFIED', async () => {
      mockCreate.mockResolvedValueOnce({
        data: { access_token: 'tok', expires_in: 3600 },
      });
      mockCreate.mockResolvedValueOnce({
        data: { verification_status: 'VERIFIED' },
      });

      const result = await provider.verifyWebhookSignature(
        {
          authAlgo: 'SHA256withRSA',
          certUrl: 'https://api.paypal.com/cert',
          transmissionId: 'tx-id',
          transmissionSig: 'sig',
          transmissionTime: '2026-05-09T00:00:00Z',
        },
        { id: 'evt-1', event_type: 'BILLING.SUBSCRIPTION.ACTIVATED' },
      );

      expect(result).toBe(true);
    });

    it('returns false when PayPal responds FAILURE', async () => {
      mockCreate.mockResolvedValueOnce({
        data: { access_token: 'tok', expires_in: 3600 },
      });
      mockCreate.mockResolvedValueOnce({
        data: { verification_status: 'FAILURE' },
      });

      const result = await provider.verifyWebhookSignature(
        { authAlgo: '', certUrl: '', transmissionId: '', transmissionSig: '', transmissionTime: '' },
        {},
      );

      expect(result).toBe(false);
    });

    it('returns true (skip) when PAYPAL_WEBHOOK_ID is not set', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'PAYPAL_WEBHOOK_ID') return '';
        return 'value';
      });
      const noWebhookIdProvider = new PayPalProvider(configService);

      const result = await noWebhookIdProvider.verifyWebhookSignature(
        { authAlgo: '', certUrl: '', transmissionId: '', transmissionSig: '', transmissionTime: '' },
        {},
      );

      expect(result).toBe(true);
    });
  });
});
