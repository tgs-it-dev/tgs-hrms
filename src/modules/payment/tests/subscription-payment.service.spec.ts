import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';
import { PayPalProvider } from '../providers/paypal.provider';
import { PaymentSubscription } from '../../../entities/payment-subscription.entity';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { SubscriptionPlan } from '../../../entities/subscription-plan.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
});

const mockPayPalProvider = () => ({
  isConfigured: true,
  createSubscription: jest.fn(),
  getSubscriptionDetails: jest.fn(),
  cancelSubscription: jest.fn(),
});

describe('SubscriptionPaymentService', () => {
  let service: SubscriptionPaymentService;
  let subscriptionRepo: ReturnType<typeof mockRepo>;
  let companyRepo: ReturnType<typeof mockRepo>;
  let planRepo: ReturnType<typeof mockRepo>;
  let tenantRepo: ReturnType<typeof mockRepo>;
  let paypal: ReturnType<typeof mockPayPalProvider>;

  beforeEach(async () => {
    subscriptionRepo = mockRepo();
    companyRepo = mockRepo();
    planRepo = mockRepo();
    tenantRepo = mockRepo();
    paypal = mockPayPalProvider();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPaymentService,
        { provide: getRepositoryToken(PaymentSubscription), useValue: subscriptionRepo },
        { provide: getRepositoryToken(CompanyDetails), useValue: companyRepo },
        { provide: getRepositoryToken(SubscriptionPlan), useValue: planRepo },
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: PayPalProvider, useValue: paypal },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              const map: Record<string, string> = {
                FRONTEND_URL: 'http://localhost:5173',
                PAYPAL_RETURN_URL: 'http://localhost:5173/signup/confirm-payment',
                PAYPAL_CANCEL_URL: 'http://localhost:5173/signup/select-plan',
              };
              return map[key] ?? def ?? '';
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionPaymentService>(SubscriptionPaymentService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createSignupSubscription', () => {
    const sessionId = 'session-uuid';
    const company: Partial<CompanyDetails> = {
      id: 'co-uuid',
      signup_session_id: sessionId,
      plan_id: 'plan-uuid',
      paypal_subscription_id: null,
      payment_provider: null,
    };
    const plan: Partial<SubscriptionPlan> = {
      id: 'plan-uuid',
      paypal_plan_id: 'P-PLAN123',
    };

    it('creates a subscription and returns approvalUrl', async () => {
      companyRepo.findOne.mockResolvedValue(company);
      planRepo.findOne.mockResolvedValue(plan);
      paypal.createSubscription.mockResolvedValue({
        subscriptionId: 'I-SUB123',
        approvalUrl: 'https://paypal.com/approve',
        status: 'APPROVAL_PENDING',
      });
      companyRepo.save.mockResolvedValue({ ...company, paypal_subscription_id: 'I-SUB123' });

      const result = await service.createSignupSubscription(sessionId, 'user@example.com', 'John', 'Doe');

      expect(result.subscriptionId).toBe('I-SUB123');
      expect(result.approvalUrl).toBe('https://paypal.com/approve');
      expect(companyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paypal_subscription_id: 'I-SUB123', payment_provider: 'paypal' }),
      );
    });

    it('throws BadRequestException when company not found', async () => {
      companyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createSignupSubscription(sessionId, 'user@example.com', 'John', 'Doe'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when plan has no PayPal plan ID', async () => {
      companyRepo.findOne.mockResolvedValue(company);
      planRepo.findOne.mockResolvedValue({ ...plan, paypal_plan_id: null });

      await expect(
        service.createSignupSubscription(sessionId, 'user@example.com', 'John', 'Doe'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyAndActivateSubscription', () => {
    const sessionId = 'session-uuid';

    it('marks company as paid when subscription is APPROVED', async () => {
      companyRepo.findOne.mockResolvedValue({
        id: 'co-uuid',
        signup_session_id: sessionId,
        paypal_subscription_id: 'I-SUB123',
        is_paid: false,
        tenant_id: null,
      });
      paypal.getSubscriptionDetails.mockResolvedValue({
        subscriptionId: 'I-SUB123',
        status: 'APPROVED',
        planId: 'P-PLAN123',
      });
      companyRepo.save.mockResolvedValue({});

      const result = await service.verifyAndActivateSubscription(sessionId, 'I-SUB123');

      expect(result.isPaid).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(companyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_paid: true }),
      );
    });

    it('returns isPaid=false when subscription is APPROVAL_PENDING', async () => {
      companyRepo.findOne.mockResolvedValue({
        id: 'co-uuid',
        signup_session_id: sessionId,
        paypal_subscription_id: 'I-SUB123',
        is_paid: false,
        tenant_id: null,
      });
      paypal.getSubscriptionDetails.mockResolvedValue({
        subscriptionId: 'I-SUB123',
        status: SubscriptionStatus.APPROVAL_PENDING,
        planId: 'P-PLAN123',
      });

      const result = await service.verifyAndActivateSubscription(sessionId, 'I-SUB123');

      expect(result.isPaid).toBe(false);
      expect(companyRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when company not found', async () => {
      companyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyAndActivateSubscription(sessionId, 'I-SUB123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelTenantSubscription', () => {
    it('cancels an active subscription', async () => {
      const tenantId = 'tenant-uuid';
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-record-uuid',
        tenant_id: tenantId,
        paypal_subscription_id: 'I-SUB123',
        status: SubscriptionStatus.ACTIVE,
      });
      paypal.cancelSubscription.mockResolvedValue(undefined);
      subscriptionRepo.save.mockResolvedValue({});

      await service.cancelTenantSubscription(tenantId, 'Customer request');

      expect(paypal.cancelSubscription).toHaveBeenCalledWith('I-SUB123', 'Customer request');
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SubscriptionStatus.CANCELLED,
          cancelled_at: expect.any(Date),
        }),
      );
    });

    it('throws NotFoundException when no active subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.cancelTenantSubscription('tenant-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
