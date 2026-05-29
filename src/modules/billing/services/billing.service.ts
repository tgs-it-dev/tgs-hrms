import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  BillingTransaction,
  BillingTransactionStatus,
  BillingTransactionType,
} from '../../../entities/billing-transaction.entity';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { EmployeeCreatedEvent } from '../events/employee-created.event';
import { EmployeeService } from '../../employee/services/employee.service';
import { forwardRef, Inject } from '@nestjs/common';
import { TenantDatabaseService } from '../../../common/services/tenant-database.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe?: Stripe;
  private readonly EMPLOYEE_CREATION_CHARGE_AMOUNT = 2.0;

  constructor(
    @InjectRepository(BillingTransaction)
    private readonly billingTransactionRepo: Repository<BillingTransaction>,
    @InjectRepository(CompanyDetails)
    private readonly companyDetailsRepo: Repository<CompanyDetails>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly configService: ConfigService,
    private readonly tenantDbService: TenantDatabaseService,
    @Inject(forwardRef(() => EmployeeService))
    private readonly employeeService?: EmployeeService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY not configured; billing operations will be logged but not executed.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return tenant?.schema_provisioned ?? false;
  }

  private getBillingRepo(
    em: EntityManager | null,
  ): Repository<BillingTransaction> {
    return em
      ? em.getRepository(BillingTransaction)
      : this.billingTransactionRepo;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Creates a checkout session for employee payment.
   * Returns checkout URL if payment method is required.
   */
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
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const companyDetails = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!companyDetails) {
      throw new Error(`Company details not found for tenant: ${tenantId}`);
    }

    if (!companyDetails.stripe_customer_id) {
      throw new Error(
        `Stripe customer ID not found for tenant: ${tenantId}. Company may not be set up for billing.`,
      );
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const employeeName =
      `${employeeData.first_name} ${employeeData.last_name}`.trim();
    const successUrl = `${frontendUrl}/employees?payment=success&checkout_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/employees?payment=cancelled`;

    try {
      const checkoutSession = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        customer: companyDetails.stripe_customer_id,
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Employee Creation: ${employeeName}`,
                description: `One-time payment for adding employee ${employeeName} (${employeeData.email})`,
              },
              unit_amount: Math.round(
                this.EMPLOYEE_CREATION_CHARGE_AMOUNT * 100,
              ),
            },
            quantity: 1,
          },
        ],
        metadata: {
          tenant_id: tenantId,
          employee_email: employeeData.email,
          employee_name: employeeName,
          employee_phone: employeeData.phone,
          employee_first_name: employeeData.first_name,
          employee_last_name: employeeData.last_name,
          designation_id: employeeData.designation_id,
          team_id: employeeData.team_id || '',
          role_id: employeeData.role_id || '',
          role_name: employeeData.role_name || '',
          gender: employeeData.gender || '',
          cnic_number: employeeData.cnic_number || '',
          type: BillingTransactionType.EMPLOYEE_CREATION,
        },
      });

      this.logger.log(
        `Checkout session created: ${checkoutSession.id} for employee ${employeeData.email}`,
      );

      return {
        checkoutUrl: checkoutSession.url || '',
        checkoutSessionId: checkoutSession.id,
      };
    } catch (stripeError: unknown) {
      const errorMessage =
        stripeError instanceof Error
          ? stripeError.message
          : 'Unknown Stripe error';
      const se = stripeError as { code?: string; stack?: string };
      const errorCode = se.code ?? 'unknown';
      this.logger.error(
        `Stripe checkout session creation failed: ${errorMessage} (code: ${errorCode})`,
        se.stack,
      );
      throw new Error(
        `Failed to create Stripe checkout session: ${errorMessage} (code: ${errorCode})`,
      );
    }
  }

  /**
   * Handles billing when an employee is created (triggered via event).
   *
   * For schema-provisioned tenants the billing_transactions table lives in the
   * tenant schema.  We wrap the entire method in withTenantSchema so both the
   * billing_transactions repo (tenant schema) and the companyDetailsRepo
   * (public schema, falls through via search_path) work transparently.
   */
  async handleEmployeeCreated(event: EmployeeCreatedEvent): Promise<void> {
    const { tenantId, employeeId, employeeEmail, employeeName } = event;

    this.logger.log(
      `Processing billing for employee creation: ${employeeId} (tenant: ${tenantId})`,
    );

    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const doWork = async (em: any) => {
      const billingRepo = this.getBillingRepo(em);

      const transaction = billingRepo.create({
        tenant_id: tenantId,
        type: BillingTransactionType.EMPLOYEE_CREATION,
        status: BillingTransactionStatus.PENDING,
        amount: this.EMPLOYEE_CREATION_CHARGE_AMOUNT,
        currency: 'USD',
        employee_id: employeeId,
        description: `Employee creation charge for ${employeeName} (${employeeEmail})`,
        metadata: {
          employee_email: employeeEmail,
          employee_name: employeeName,
        },
      });

      try {
        // company_details is in public schema and resolves via search_path fallback
        const companyDetails = await this.companyDetailsRepo.findOne({
          where: { tenant_id: tenantId },
        });

        if (!companyDetails) {
          throw new Error(`Company details not found for tenant: ${tenantId}`);
        }

        if (!companyDetails.stripe_customer_id) {
          throw new Error(
            `Stripe customer ID not found for tenant: ${tenantId}. Company may not be set up for billing.`,
          );
        }

        transaction.stripe_customer_id = companyDetails.stripe_customer_id;

        if (!this.stripe) {
          this.logger.warn(
            'Stripe not configured. Marking transaction as success without actual charge.',
          );
          transaction.status = BillingTransactionStatus.SUCCESS;
          transaction.description = `${transaction.description} (Stripe not configured - charge skipped)`;
          await billingRepo.save(transaction);
          return;
        }

        const customer = await this.stripe.customers.retrieve(
          companyDetails.stripe_customer_id,
        );
        const hasPaymentMethod =
          customer &&
          typeof customer === 'object' &&
          'invoice_settings' in customer &&
          customer.invoice_settings?.default_payment_method !== null;

        if (!hasPaymentMethod) {
          throw new Error('PAYMENT_METHOD_REQUIRED');
        }

        let paymentIntent;
        try {
          paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(this.EMPLOYEE_CREATION_CHARGE_AMOUNT * 100),
            currency: 'usd',
            customer: companyDetails.stripe_customer_id,
            description: `Employee creation: ${employeeName} (${employeeEmail})`,
            metadata: {
              tenant_id: tenantId,
              employee_id: employeeId,
              employee_email: employeeEmail,
              type: BillingTransactionType.EMPLOYEE_CREATION,
            },
            confirm: true,
            payment_method_types: ['card'],
          });

          if (paymentIntent.status !== 'succeeded') {
            throw new Error('PAYMENT_METHOD_REQUIRED');
          }

          transaction.status = BillingTransactionStatus.SUCCESS;
          transaction.stripe_charge_id = paymentIntent.id;
          await billingRepo.save(transaction);

          this.logger.log(
            `Successfully charged $${this.EMPLOYEE_CREATION_CHARGE_AMOUNT} for employee: ${employeeId}`,
          );
        } catch (paymentError: unknown) {
          const pe = paymentError as { code?: string; message?: string };
          if (
            pe.code === 'payment_intent_authentication_required' ||
            pe.message?.includes('requires customer action') ||
            pe.message?.includes('Payment method') ||
            pe.message === 'PAYMENT_METHOD_REQUIRED'
          ) {
            throw new Error('PAYMENT_METHOD_REQUIRED');
          }
          throw paymentError;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to process billing for employee creation: ${employeeId}. Error: ${errorMessage}`,
        );

        transaction.status = BillingTransactionStatus.FAILED;
        transaction.error_message = errorMessage;
        await billingRepo.save(transaction);

        throw new Error(`Payment processing failed: ${errorMessage}`);
      }
    };

    if (isProvisioned) {
      await this.tenantDbService.withTenantSchema(tenantId, (em) => doWork(em));
    } else {
      await doWork(null);
    }
  }

  /**
   * Confirms employee payment and creates the employee after a successful checkout.
   */
  async confirmEmployeePayment(
    checkoutSessionId: string,
    tenantId: string,
  ): Promise<{
    success: boolean;
    paymentConfirmed?: boolean;
    paymentStatus?: string;
    paymentIntentId?: string;
    checkoutSessionId?: string;
    employeeId?: string;
    message?: string;
    warning?: string;
    employeeData?: {
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
    };
  }> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const checkoutSession = await this.stripe.checkout.sessions.retrieve(
      checkoutSessionId,
      { expand: ['payment_intent'] },
    );

    const isPaymentSuccessful =
      checkoutSession.payment_status === 'paid' ||
      checkoutSession.status === 'complete' ||
      (checkoutSession.payment_intent &&
        typeof checkoutSession.payment_intent === 'object' &&
        checkoutSession.payment_intent.status === 'succeeded');

    if (!isPaymentSuccessful) {
      throw new BadRequestException(
        `Payment not completed. Current status: ${checkoutSession.payment_status || checkoutSession.status}`,
      );
    }

    const metadata = checkoutSession.metadata;

    if (!metadata || !metadata.employee_email) {
      throw new BadRequestException(
        'Employee data not found in payment metadata',
      );
    }

    if (metadata.tenant_id !== tenantId) {
      throw new BadRequestException('Tenant ID mismatch');
    }

    const employeeData = {
      email: metadata.employee_email,
      phone: metadata.employee_phone,
      first_name: metadata.employee_first_name,
      last_name: metadata.employee_last_name,
      designation_id: metadata.designation_id,
      team_id: metadata.team_id || undefined,
      role_id: metadata.role_id || undefined,
      role_name: metadata.role_name || undefined,
      gender: metadata.gender || undefined,
      cnic_number: metadata.cnic_number || undefined,
    };

    const saveTransaction = async (
      billingRepo: Repository<BillingTransaction>,
    ) => {
      const existingTransactions = await billingRepo.find({
        where: {
          tenant_id: tenantId,
          type: BillingTransactionType.EMPLOYEE_CREATION,
        },
        order: { created_at: 'DESC' },
      });

      const existingTransaction = existingTransactions.find(
        (t) =>
          t.metadata &&
          typeof t.metadata === 'object' &&
          (t.metadata as Record<string, unknown>).employee_email ===
            metadata.employee_email &&
          (t.status === BillingTransactionStatus.FAILED ||
            t.status === BillingTransactionStatus.PENDING),
      );

      let transaction: BillingTransaction;
      if (existingTransaction) {
        transaction = existingTransaction;
        transaction.status = BillingTransactionStatus.SUCCESS;
        transaction.stripe_customer_id = checkoutSession.customer as string;
        transaction.stripe_charge_id = checkoutSession.payment_intent as string;

        transaction.description = `Employee creation charge for ${metadata.employee_name} (${metadata.employee_email})`;
        transaction.error_message = null;
        transaction.metadata = {
          ...(transaction.metadata && typeof transaction.metadata === 'object'
            ? transaction.metadata
            : {}),
          checkout_session_id: checkoutSessionId,

          employee_email: metadata.employee_email,
          employee_name: metadata.employee_name,
        };
      } else {
        transaction = billingRepo.create({
          tenant_id: tenantId,
          type: BillingTransactionType.EMPLOYEE_CREATION,
          status: BillingTransactionStatus.SUCCESS,
          amount: this.EMPLOYEE_CREATION_CHARGE_AMOUNT,
          currency: 'USD',
          stripe_customer_id: checkoutSession.customer as string,
          stripe_charge_id: checkoutSession.payment_intent as string,

          description: `Employee creation charge for ${metadata.employee_name} (${metadata.employee_email})`,
          metadata: {
            checkout_session_id: checkoutSessionId,

            employee_email: metadata.employee_email,
            employee_name: metadata.employee_name,
          },
        });
      }

      await billingRepo.save(transaction);
      return transaction;
    };

    let transaction: BillingTransaction;
    if (isProvisioned) {
      transaction = await this.tenantDbService.withTenantSchema(
        tenantId,
        (em) => saveTransaction(em.getRepository(BillingTransaction)),
      );
    } else {
      transaction = await saveTransaction(this.billingTransactionRepo);
    }

    this.logger.log(
      `Payment confirmed for employee creation: ${metadata.employee_email} (session: ${checkoutSessionId})`,
    );

    if (this.employeeService) {
      try {
        const createdEmployee = await this.employeeService.createAfterPayment(
          tenantId,
          employeeData,
          checkoutSessionId,
        );

        // Update transaction with employee_id
        if (isProvisioned) {
          await this.tenantDbService.withTenantSchema(tenantId, async (em) => {
            const billingRepo = em.getRepository(BillingTransaction);
            await billingRepo.update(transaction.id, {
              employee_id: createdEmployee.id,
            });
          });
        } else {
          await this.billingTransactionRepo.update(transaction.id, {
            employee_id: createdEmployee.id,
          });
        }

        this.logger.log(
          `Employee created after payment: ${createdEmployee.id}`,
        );

        return {
          success: true,
          paymentConfirmed: true,
          paymentStatus:
            checkoutSession.payment_status || checkoutSession.status,
          paymentIntentId:
            typeof checkoutSession.payment_intent === 'string'
              ? checkoutSession.payment_intent
              : checkoutSession.payment_intent?.id,
          checkoutSessionId,
          employeeId: createdEmployee.id,
          message:
            'Payment confirmed successfully. Employee created and invitation email sent',
        };
      } catch (error) {
        this.logger.error(
          `Failed to create employee after payment: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
          success: true,
          employeeData,
          warning:
            'Payment successful but employee creation failed. Please contact support.',
        };
      }
    }

    return { success: true, employeeData };
  }

  async getTransactionsByTenant(
    tenantId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ transactions: BillingTransaction[]; total: number }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const doQuery = async (billingRepo: Repository<BillingTransaction>) => {
      const [transactions, total] = await billingRepo.findAndCount({
        where: { tenant_id: tenantId },
        order: { created_at: 'DESC' },
        take: limit,
        skip: offset,
      });
      return { transactions, total };
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(BillingTransaction)),
      );
    }
    return doQuery(this.billingTransactionRepo);
  }

  async getTransactionById(
    transactionId: string,
    tenantId: string,
  ): Promise<BillingTransaction | null> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const doQuery = async (billingRepo: Repository<BillingTransaction>) =>
      billingRepo.findOne({
        where: { id: transactionId, tenant_id: tenantId },
      });

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(BillingTransaction)),
      );
    }
    return doQuery(this.billingTransactionRepo);
  }

  // ---------------------------------------------------------------------------
  // Stripe Webhook
  // ---------------------------------------------------------------------------

  /**
   * Verifies the Stripe webhook signature and returns the parsed event.
   * Throws BadRequestException if the signature is invalid.
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        `Webhook signature verification failed: ${msg}`,
      );
    }
  }

  /**
   * Handles an incoming verified Stripe webhook event.
   * Currently handles: payment_intent.payment_failed, charge.refunded,
   * checkout.session.completed (idempotent retry-safe confirmation).
   */
  async handleWebhookEvent(
    event: Stripe.Event,
  ): Promise<{ received: boolean }> {
    this.logger.log(
      `Processing Stripe webhook event: ${event.type} (id: ${event.id})`,
    );

    switch (event.type) {
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        await this.handlePaymentFailed(paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        await this.handleChargeRefunded(charge);
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object;
        if (
          session.metadata?.type === BillingTransactionType.EMPLOYEE_CREATION &&
          session.metadata?.tenant_id
        ) {
          // Idempotent: confirmEmployeePayment is safe to call multiple times
          try {
            await this.confirmEmployeePayment(
              session.id,
              session.metadata.tenant_id,
            );
            this.logger.log(
              `Webhook: confirmed employee payment for session ${session.id}`,
            );
          } catch (err) {
            // If already processed, log and continue
            this.logger.warn(
              `Webhook: session ${session.id} already processed or failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
        break;
      }

      default:
        this.logger.debug(`Unhandled Stripe webhook event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const tenantId = paymentIntent.metadata?.tenant_id;
    if (!tenantId) {
      this.logger.warn(
        `payment_intent.payment_failed: no tenant_id in metadata (id: ${paymentIntent.id})`,
      );
      return;
    }

    const updateStatus = async (repo: Repository<BillingTransaction>) => {
      const transaction = await repo.findOne({
        where: { stripe_charge_id: paymentIntent.id, tenant_id: tenantId },
      });
      if (transaction) {
        transaction.status = BillingTransactionStatus.FAILED;
        transaction.error_message =
          paymentIntent.last_payment_error?.message ?? 'Payment failed';
        await repo.save(transaction);
        this.logger.warn(
          `Payment failed for transaction ${transaction.id} (tenant: ${tenantId}): ${transaction.error_message}`,
        );
      }
    };

    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      await this.tenantDbService.withTenantSchema(tenantId, (em) =>
        updateStatus(em.getRepository(BillingTransaction)),
      );
    } else {
      await updateStatus(this.billingTransactionRepo);
    }
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const tenantId = charge.metadata?.tenant_id;
    if (!tenantId) {
      this.logger.warn(
        `charge.refunded: no tenant_id in metadata (charge: ${charge.id})`,
      );
      return;
    }

    const updateStatus = async (repo: Repository<BillingTransaction>) => {
      const transaction = await repo.findOne({
        where: {
          stripe_charge_id: charge.payment_intent as string,
          tenant_id: tenantId,
        },
      });
      if (transaction) {
        transaction.status = BillingTransactionStatus.FAILED;
        transaction.error_message = `Refunded on ${new Date().toISOString()}`;
        await repo.save(transaction);
        this.logger.log(
          `Charge refunded for transaction ${transaction.id} (tenant: ${tenantId})`,
        );
      }
    };

    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      await this.tenantDbService.withTenantSchema(tenantId, (em) =>
        updateStatus(em.getRepository(BillingTransaction)),
      );
    } else {
      await updateStatus(this.billingTransactionRepo);
    }
  }
}
