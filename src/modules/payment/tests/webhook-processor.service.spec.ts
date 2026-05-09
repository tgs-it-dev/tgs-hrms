import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookProcessorService } from '../services/webhook-processor.service';
import { PayPalProvider } from '../providers/paypal.provider';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';
import { AddonPaymentService } from '../services/addon-payment.service';
import { PaymentTransaction } from '../../../entities/payment-transaction.entity';
import { PaymentSubscription } from '../../../entities/payment-subscription.entity';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { PAYPAL_WEBHOOK_EVENTS } from '../constants/payment.constants';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((data: unknown) => data),
});

const validHeaders = {
  authAlgo: 'SHA256withRSA',
  certUrl: 'https://api.paypal.com/cert',
  transmissionId: 'tx-123',
  transmissionSig: 'sig-abc',
  transmissionTime: '2026-05-09T00:00:00Z',
};

const buildEvent = (eventType: string, resource: Record<string, unknown>, id = 'evt-unique-id') => ({
  id,
  event_type: eventType,
  create_time: '2026-05-09T00:00:00Z',
  resource,
});

describe('WebhookProcessorService', () => {
  let service: WebhookProcessorService;
  let transactionRepo: ReturnType<typeof mockRepo>;
  let subscriptionRepo: ReturnType<typeof mockRepo>;
  let companyRepo: ReturnType<typeof mockRepo>;
  let paypal: jest.Mocked<Partial<PayPalProvider>>;
  let subscriptionService: jest.Mocked<Partial<SubscriptionPaymentService>>;
  let addonService: jest.Mocked<Partial<AddonPaymentService>>;

  beforeEach(async () => {
    transactionRepo = mockRepo();
    subscriptionRepo = mockRepo();
    companyRepo = mockRepo();

    paypal = {
      verifyWebhookSignature: jest.fn().mockResolvedValue(true),
    };

    subscriptionService = {
      findByPayPalSubscriptionId: jest.fn().mockResolvedValue(null),
      updateSubscriptionStatus: jest.fn().mockResolvedValue(undefined),
      activateTenant: jest.fn().mockResolvedValue(undefined),
      suspendTenantAccess: jest.fn().mockResolvedValue(undefined),
    };

    addonService = {
      findByPayPalOrderId: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookProcessorService,
        { provide: getRepositoryToken(PaymentTransaction), useValue: transactionRepo },
        { provide: getRepositoryToken(PaymentSubscription), useValue: subscriptionRepo },
        { provide: getRepositoryToken(CompanyDetails), useValue: companyRepo },
        { provide: PayPalProvider, useValue: paypal },
        { provide: SubscriptionPaymentService, useValue: subscriptionService },
        { provide: AddonPaymentService, useValue: addonService },
      ],
    }).compile();

    service = module.get<WebhookProcessorService>(WebhookProcessorService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('receive() — signature verification', () => {
    it('throws UnauthorizedException when signature verification fails', async () => {
      (paypal.verifyWebhookSignature as jest.Mock).mockResolvedValue(false);

      await expect(
        service.receive(
          buildEvent(PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_ACTIVATED, { id: 'I-SUB', plan_id: 'P-PLAN' }),
          validHeaders,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('receive() — idempotency', () => {
    it('skips processing when event ID already exists', async () => {
      transactionRepo.findOne.mockResolvedValue({ id: 'existing-tx', webhook_event_id: 'evt-unique-id' });

      const result = await service.receive(
        buildEvent(PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_ACTIVATED, { id: 'I-SUB', plan_id: 'P-PLAN' }),
        validHeaders,
      );

      expect(result.processed).toBe(false);
      expect(subscriptionService.updateSubscriptionStatus).not.toHaveBeenCalled();
    });
  });

  describe('BILLING.SUBSCRIPTION.ACTIVATED', () => {
    it('updates subscription status to ACTIVE and activates tenant', async () => {
      transactionRepo.findOne.mockResolvedValue(null);
      (subscriptionService.findByPayPalSubscriptionId as jest.Mock).mockResolvedValue({
        id: 'sub-record',
        tenant_id: 'tenant-uuid',
        paypal_subscription_id: 'I-SUB123',
      });
      companyRepo.findOne.mockResolvedValue(null);
      transactionRepo.save.mockResolvedValue({});

      const result = await service.receive(
        buildEvent(
          PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_ACTIVATED,
          { id: 'I-SUB123', plan_id: 'P-PLAN', status: 'ACTIVE' },
        ),
        validHeaders,
      );

      expect(result.processed).toBe(true);
      expect(subscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
        'I-SUB123',
        SubscriptionStatus.ACTIVE,
        expect.objectContaining({ started_at: expect.any(Date) }),
      );
      expect(subscriptionService.activateTenant).toHaveBeenCalledWith('tenant-uuid');
    });
  });

  describe('BILLING.SUBSCRIPTION.CANCELLED', () => {
    it('marks subscription cancelled and suspends tenant', async () => {
      transactionRepo.findOne.mockResolvedValue(null);
      (subscriptionService.findByPayPalSubscriptionId as jest.Mock).mockResolvedValue({
        id: 'sub-record',
        tenant_id: 'tenant-uuid',
        paypal_subscription_id: 'I-SUB123',
      });
      transactionRepo.save.mockResolvedValue({});

      await service.receive(
        buildEvent(
          PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_CANCELLED,
          { id: 'I-SUB123', plan_id: 'P-PLAN' },
        ),
        validHeaders,
      );

      expect(subscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
        'I-SUB123',
        SubscriptionStatus.CANCELLED,
        expect.objectContaining({ cancelled_at: expect.any(Date) }),
      );
      expect(subscriptionService.suspendTenantAccess).toHaveBeenCalledWith('tenant-uuid');
    });
  });

  describe('BILLING.SUBSCRIPTION.SUSPENDED', () => {
    it('suspends tenant on subscription suspension', async () => {
      transactionRepo.findOne.mockResolvedValue(null);
      (subscriptionService.findByPayPalSubscriptionId as jest.Mock).mockResolvedValue({
        tenant_id: 'tenant-uuid',
        paypal_subscription_id: 'I-SUB123',
      });
      transactionRepo.save.mockResolvedValue({});

      await service.receive(
        buildEvent(
          PAYPAL_WEBHOOK_EVENTS.SUBSCRIPTION_SUSPENDED,
          { id: 'I-SUB123', plan_id: 'P-PLAN' },
        ),
        validHeaders,
      );

      expect(subscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
        'I-SUB123',
        SubscriptionStatus.SUSPENDED,
      );
      expect(subscriptionService.suspendTenantAccess).toHaveBeenCalledWith('tenant-uuid');
    });
  });

  describe('PAYMENT.SALE.COMPLETED', () => {
    it('records a successful payment transaction', async () => {
      transactionRepo.findOne.mockResolvedValue(null);
      (subscriptionService.findByPayPalSubscriptionId as jest.Mock).mockResolvedValue({
        tenant_id: 'tenant-uuid',
        paypal_subscription_id: 'I-SUB123',
      });
      transactionRepo.save.mockResolvedValue({});

      await service.receive(
        buildEvent(PAYPAL_WEBHOOK_EVENTS.SALE_COMPLETED, {
          id: 'SALE-123',
          state: 'completed',
          amount: { total: '29.99', currency: 'USD' },
          billing_agreement_id: 'I-SUB123',
        }),
        validHeaders,
      );

      expect(subscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
        'I-SUB123',
        SubscriptionStatus.ACTIVE,
      );
    });
  });

  describe('unhandled event types', () => {
    it('logs warning without throwing for unknown event types', async () => {
      transactionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.receive(
          buildEvent('UNKNOWN.EVENT.TYPE', { id: 'res-1' }),
          validHeaders,
        ),
      ).resolves.toMatchObject({ processed: true, eventType: 'UNKNOWN.EVENT.TYPE' });
    });
  });
});
