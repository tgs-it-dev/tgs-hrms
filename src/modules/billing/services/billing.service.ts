import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BillingTransaction,
  BillingTransactionStatus,
  BillingTransactionType,
} from '../../../entities/billing-transaction.entity';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { EmployeeCreatedEvent } from '../events/employee-created.event';
import { TenantDatabaseService } from '../../../common/services/tenant-database.service';
import { PayPalProvider } from '../../payment/providers/paypal.provider';
import { PAYPAL_DEFAULT_CURRENCY } from '../../payment/constants/payment.constants';

const EMPLOYEE_CREATION_CHARGE_AMOUNT = 2.0 as const;

export interface ConfirmEmployeePaymentResult {
  success: boolean;
  paymentConfirmed: boolean;
  paymentStatus: string;
  captureId: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(BillingTransaction)
    private readonly billingTransactionRepo: Repository<BillingTransaction>,
    @InjectRepository(CompanyDetails)
    private readonly companyDetailsRepo: Repository<CompanyDetails>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly configService: ConfigService,
    private readonly tenantDbService: TenantDatabaseService,
    private readonly paypal: PayPalProvider,
  ) {}

  async createEmployeePaymentCheckout(
    tenantId: string,
    employeeData: {
      email: string;
      phone: string;
      first_name: string;
      last_name: string;
      designation_id: string;
      team_id?: string | null;
      role_id?: string | null;
      role_name?: string;
      gender?: string;
      cnic_number?: string;
      password?: string;
    },
  ): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
    if (!this.paypal.isConfigured) {
      throw new BadRequestException('Payment provider (PayPal) is not configured');
    }

    const employeeName = `${employeeData.first_name} ${employeeData.last_name}`.trim();
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const returnUrl = `${frontendUrl}/employees?payment=success&employee_email=${encodeURIComponent(employeeData.email)}`;
    const cancelUrl = `${frontendUrl}/employees?payment=cancelled`;

    const order = await this.paypal.createOrder({
      amount: EMPLOYEE_CREATION_CHARGE_AMOUNT,
      currency: PAYPAL_DEFAULT_CURRENCY,
      description: `Employee creation: ${employeeName} (${employeeData.email})`,
      returnUrl,
      cancelUrl,
      // Use tenantId (36 chars) as custom_id — PayPal enforces a 127-char limit.
      // Full employee data is stored in billing_transactions.metadata after capture.
      customId: tenantId,
    });

    this.logger.log(`PayPal order created: ${order.orderId} for employee ${employeeData.email} (tenant: ${tenantId})`);

    return { checkoutUrl: order.approvalUrl, checkoutSessionId: order.orderId };
  }

  async handleEmployeeCreated(event: EmployeeCreatedEvent): Promise<void> {
    const { tenantId, employeeId, employeeEmail, employeeName } = event;

    this.logger.log(`Billing event received for employee creation: ${employeeId} (tenant: ${tenantId})`);

    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const doWork = async (repo: Repository<BillingTransaction>) => {
      await repo.save(
        repo.create({
          tenant_id: tenantId,
          type: BillingTransactionType.EMPLOYEE_CREATION,
          status: BillingTransactionStatus.PENDING,
          amount: EMPLOYEE_CREATION_CHARGE_AMOUNT,
          currency: PAYPAL_DEFAULT_CURRENCY,
          employee_id: employeeId,
          description: `Employee creation charge for ${employeeName} (${employeeEmail})`,
          metadata: { employee_email: employeeEmail, employee_name: employeeName },
        }),
      );
      // PayPal cannot auto-charge — signal to the caller to use the checkout flow
      throw new Error('PAYMENT_METHOD_REQUIRED');
    };

    if (isProvisioned) {
      await this.tenantDbService.withTenantSchema(tenantId, (em) =>
        doWork(em.getRepository(BillingTransaction)),
      );
    } else {
      await doWork(this.billingTransactionRepo);
    }
  }

  async confirmEmployeePayment(
    checkoutSessionId: string,
    tenantId: string,
  ): Promise<ConfirmEmployeePaymentResult> {
    if (!this.paypal.isConfigured) {
      throw new BadRequestException('Payment provider (PayPal) is not configured');
    }

    const capture = await this.paypal.captureOrder(checkoutSessionId);

    if (capture.status !== 'COMPLETED') {
      throw new BadRequestException(`Payment not completed. PayPal capture status: ${capture.status}`);
    }

    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const saveTransaction = async (repo: Repository<BillingTransaction>) => {
      const existing = await repo.findOne({
        where: { tenant_id: tenantId, paypal_order_id: checkoutSessionId },
      });

      if (existing) {
        existing.status = BillingTransactionStatus.SUCCESS;
        existing.paypal_capture_id = capture.captureId;
        return repo.save(existing);
      }

      return repo.save(
        repo.create({
          tenant_id: tenantId,
          type: BillingTransactionType.EMPLOYEE_CREATION,
          status: BillingTransactionStatus.SUCCESS,
          amount: capture.amount,
          currency: capture.currency,
          paypal_order_id: checkoutSessionId,
          paypal_capture_id: capture.captureId,
          description: `Employee creation charge — PayPal order ${checkoutSessionId}`,
        }),
      );
    };

    if (isProvisioned) {
      await this.tenantDbService.withTenantSchema(tenantId, (em) =>
        saveTransaction(em.getRepository(BillingTransaction)),
      );
    } else {
      await saveTransaction(this.billingTransactionRepo);
    }

    this.logger.log(`PayPal capture confirmed: ${capture.captureId} for tenant ${tenantId}`);

    return {
      success: true,
      paymentConfirmed: true,
      paymentStatus: capture.status,
      captureId: capture.captureId,
    };
  }

  async getTransactionsByTenant(
    tenantId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ transactions: BillingTransaction[]; total: number }> {
    const doQuery = async (repo: Repository<BillingTransaction>) => {
      const [transactions, total] = await repo.findAndCount({
        where: { tenant_id: tenantId },
        order: { created_at: 'DESC' },
        take: limit,
        skip: offset,
      });
      return { transactions, total };
    };

    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(BillingTransaction)),
      );
    }
    return doQuery(this.billingTransactionRepo);
  }

  async getTransactionById(transactionId: string, tenantId: string): Promise<BillingTransaction | null> {
    const doQuery = async (repo: Repository<BillingTransaction>) =>
      repo.findOne({ where: { id: transactionId, tenant_id: tenantId } });

    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(BillingTransaction)),
      );
    }
    return doQuery(this.billingTransactionRepo);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return tenant?.schema_provisioned ?? false;
  }
}
