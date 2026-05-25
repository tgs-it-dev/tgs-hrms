import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BillingService } from './billing.service';
import {
  BillingTransaction,
  BillingTransactionStatus,
  BillingTransactionType,
} from '../../../entities/billing-transaction.entity';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { TenantDatabaseService } from '../../../common/services/tenant-database.service';
import { EmployeeService } from '../../employee/services/employee.service';

// ── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-00000000-0000-0000-0000-000000000001';
const TXN_ID = 'txn-00000000-0000-0000-0000-000000000001';

const mockTransaction: BillingTransaction = {
  id: TXN_ID,
  tenant_id: TENANT_ID,
  type: BillingTransactionType.EMPLOYEE_CREATION,
  status: BillingTransactionStatus.SUCCESS,
  amount: 2.0,
  currency: 'USD',
  stripe_charge_id: 'ch_test_123',
  stripe_customer_id: 'cus_test_123',
  employee_id: 'emp-uuid',
  description: 'Employee creation fee',
  error_message: null,
  metadata: null,
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
};

const mockTenantUnprovisioned: Tenant = {
  id: TENANT_ID,
  name: 'Test Corp',
  status: 'active',
  schema_provisioned: false,
  workflow_enabled: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  users: [],
  departments: [],
  designations: [],
  leaves: [],
  geofences: [],
} as Tenant;

// ── Mock factories ───────────────────────────────────────────────────────────

const mockBillingTransactionRepo = () => ({
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockCompanyDetailsRepo = () => ({
  findOne: jest.fn(),
});

const mockTenantRepo = () => ({
  findOne: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue(undefined), // no STRIPE_SECRET_KEY by default
});

const mockTenantDbService = () => ({
  withTenantSchema: jest.fn(),
  withTenantSchemaReadOnly: jest.fn(),
});

const mockEmployeeService = () => ({
  createEmployee: jest.fn(),
});

// ── Test suite ───────────────────────────────────────────────────────────────

describe('BillingService', () => {
  let service: BillingService;
  let billingRepo: ReturnType<typeof mockBillingTransactionRepo>;
  let tenantRepo: ReturnType<typeof mockTenantRepo>;
  let tenantDbService: ReturnType<typeof mockTenantDbService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getRepositoryToken(BillingTransaction), useFactory: mockBillingTransactionRepo },
        { provide: getRepositoryToken(CompanyDetails), useFactory: mockCompanyDetailsRepo },
        { provide: getRepositoryToken(Tenant), useFactory: mockTenantRepo },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: TenantDatabaseService, useFactory: mockTenantDbService },
        { provide: EmployeeService, useFactory: mockEmployeeService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    billingRepo = module.get(getRepositoryToken(BillingTransaction));
    tenantRepo = module.get(getRepositoryToken(Tenant));
    tenantDbService = module.get(TenantDatabaseService);
  });

  // ── getTransactionsByTenant ────────────────────────────────────────────────

  describe('getTransactionsByTenant', () => {
    it('returns transactions and total for an unprovisioned tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(mockTenantUnprovisioned);
      billingRepo.findAndCount.mockResolvedValue([[mockTransaction], 1]);

      const result = await service.getTransactionsByTenant(TENANT_ID, 50, 0);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].id).toBe(TXN_ID);
      expect(result.total).toBe(1);
      expect(billingRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_ID },
          take: 50,
          skip: 0,
        }),
      );
    });

    it('applies limit and offset correctly', async () => {
      tenantRepo.findOne.mockResolvedValue(mockTenantUnprovisioned);
      billingRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getTransactionsByTenant(TENANT_ID, 10, 20);

      expect(billingRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });

    it('returns empty list when no transactions exist', async () => {
      tenantRepo.findOne.mockResolvedValue(mockTenantUnprovisioned);
      billingRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getTransactionsByTenant(TENANT_ID);

      expect(result.transactions).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('uses tenant schema when tenant is provisioned', async () => {
      const provisionedTenant = { ...mockTenantUnprovisioned, schema_provisioned: true };
      tenantRepo.findOne.mockResolvedValue(provisionedTenant);
      tenantDbService.withTenantSchemaReadOnly.mockImplementation(
        async (_id: string, work: (em: { getRepository: () => Repository<BillingTransaction> }) => Promise<unknown>) =>
          work({ getRepository: () => billingRepo as unknown as Repository<BillingTransaction> }),
      );
      billingRepo.findAndCount.mockResolvedValue([[mockTransaction], 1]);

      const result = await service.getTransactionsByTenant(TENANT_ID);

      expect(tenantDbService.withTenantSchemaReadOnly).toHaveBeenCalled();
      expect(result.total).toBe(1);
    });
  });

  // ── getTransactionById ─────────────────────────────────────────────────────

  describe('getTransactionById', () => {
    it('returns the transaction when found', async () => {
      tenantRepo.findOne.mockResolvedValue(mockTenantUnprovisioned);
      billingRepo.findOne.mockResolvedValue(mockTransaction);

      const result = await service.getTransactionById(TXN_ID, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(TXN_ID);
      expect(billingRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TXN_ID, tenant_id: TENANT_ID },
        }),
      );
    });

    it('returns null when transaction does not exist', async () => {
      tenantRepo.findOne.mockResolvedValue(mockTenantUnprovisioned);
      billingRepo.findOne.mockResolvedValue(null);

      const result = await service.getTransactionById('non-existent-id', TENANT_ID);

      expect(result).toBeNull();
    });

    it('returns null when transaction belongs to a different tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(mockTenantUnprovisioned);
      // The WHERE clause includes tenant_id so a cross-tenant query returns null
      billingRepo.findOne.mockResolvedValue(null);

      const result = await service.getTransactionById(TXN_ID, 'different-tenant-id');

      expect(result).toBeNull();
    });
  });
});
