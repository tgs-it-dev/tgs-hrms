import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  BillingTransaction,
  BillingTransactionStatus,
  BillingTransactionType,
} from '../../../entities/billing-transaction.entity';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { EmployeeCreatedEvent } from '../events/employee-created.event';
import { EmployeeService } from '../../employee/services/employee.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe?: Stripe;
  private readonly EMPLOYEE_CREATION_CHARGE_AMOUNT = 2.0; // $2 per employee

  constructor(
    @InjectRepository(BillingTransaction)
    private readonly billingTransactionRepo: Repository<BillingTransaction>,
    @InjectRepository(CompanyDetails)
    private readonly companyDetailsRepo: Repository<CompanyDetails>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => EmployeeService))
    private readonly employeeService?: EmployeeService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not configured; billing operations will be logged but not executed.');
    }
  }

  /**
   * Creates a checkout session for employee payment
   * Returns checkout URL if payment method is required
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
      profile_picture_url?: string;
      cnic_picture_url?: string;
      cnic_back_picture_url?: string;
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
      throw new Error(`Stripe customer ID not found for tenant: ${tenantId}. Company may not be set up for billing.`);
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const employeeName = `${employeeData.first_name} ${employeeData.last_name}`.trim();
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
              unit_amount: Math.round(this.EMPLOYEE_CREATION_CHARGE_AMOUNT * 100), // Convert to cents
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
          profile_picture_url: employeeData.profile_picture_url || '',
          cnic_picture_url: employeeData.cnic_picture_url || '',
          cnic_back_picture_url: employeeData.cnic_back_picture_url || '',
          type: BillingTransactionType.EMPLOYEE_CREATION,
        },
      });

      this.logger.log(
        `Checkout session created successfully: ${checkoutSession.id} for employee ${employeeData.email}`,
      );

      return {
        checkoutUrl: checkoutSession.url || '',
        checkoutSessionId: checkoutSession.id,
      };
    } catch (stripeError: any) {
      const errorMessage = stripeError?.message || 'Unknown Stripe error';
      const errorCode = stripeError?.code || 'unknown';
      this.logger.error(
        `Stripe checkout session creation failed: ${errorMessage} (code: ${errorCode})`,
        stripeError?.stack,
      );
      throw new Error(`Failed to create Stripe checkout session: ${errorMessage} (code: ${errorCode})`);
    }
  }

  /**
   * Handles billing when an employee is created
   * This method is called via event listener and is decoupled from employee creation logic
   */
  async handleEmployeeCreated(event: EmployeeCreatedEvent): Promise<void> {
    const { tenantId, employeeId, employeeEmail, employeeName } = event;

    this.logger.log(`Processing billing for employee creation: ${employeeId} (tenant: ${tenantId})`);

    // Create a pending transaction record first
    const transaction = this.billingTransactionRepo.create({
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
      // Get company details to retrieve Stripe customer ID
      const companyDetails = await this.companyDetailsRepo.findOne({
        where: { tenant_id: tenantId },
      });

      if (!companyDetails) {
        throw new Error(`Company details not found for tenant: ${tenantId}`);
      }

      if (!companyDetails.stripe_customer_id) {
        throw new Error(`Stripe customer ID not found for tenant: ${tenantId}. Company may not be set up for billing.`);
      }

      transaction.stripe_customer_id = companyDetails.stripe_customer_id;

      // If Stripe is not configured, mark as success (for development/testing)
      if (!this.stripe) {
        this.logger.warn('Stripe not configured. Marking transaction as success without actual charge.');
        transaction.status = BillingTransactionStatus.SUCCESS;
        transaction.description = `${transaction.description} (Stripe not configured - charge skipped)`;
        await this.billingTransactionRepo.save(transaction);
        return;
      }

      // Check if customer has a default payment method
      const customer = await this.stripe.customers.retrieve(companyDetails.stripe_customer_id);
      const hasPaymentMethod =
        customer &&
        typeof customer === 'object' &&
        'invoice_settings' in customer &&
        customer.invoice_settings?.default_payment_method !== null;

      // If no payment method, throw error to create checkout session
      if (!hasPaymentMethod) {
        throw new Error('PAYMENT_METHOD_REQUIRED');
      }

      // Create Payment Intent with customer's default payment method
      let paymentIntent;
      try {
        paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(this.EMPLOYEE_CREATION_CHARGE_AMOUNT * 100), // Convert to cents
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

        // Check if payment intent succeeded
        if (paymentIntent.status !== 'succeeded') {
          throw new Error('PAYMENT_METHOD_REQUIRED');
        }

        // Update transaction with success status
        transaction.status = BillingTransactionStatus.SUCCESS;
        transaction.stripe_charge_id = paymentIntent.id;

        // Save successful transaction
        await this.billingTransactionRepo.save(transaction);

        this.logger.log(
          `Successfully charged $${this.EMPLOYEE_CREATION_CHARGE_AMOUNT} for employee creation: ${employeeId} (Stripe payment intent: ${paymentIntent.id})`,
        );
      } catch (paymentError: any) {
        // If payment requires customer action, throw special error
        if (
          paymentError?.code === 'payment_intent_authentication_required' ||
          paymentError?.message?.includes('requires customer action') ||
          paymentError?.message?.includes('Payment method') ||
          paymentError?.message === 'PAYMENT_METHOD_REQUIRED'
        ) {
          throw new Error('PAYMENT_METHOD_REQUIRED');
        }
        throw paymentError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process billing for employee creation: ${employeeId}. Error: ${errorMessage}`);

      // Mark transaction as failed
      transaction.status = BillingTransactionStatus.FAILED;
      transaction.error_message = errorMessage;

      // Save the failed transaction for audit purposes
      await this.billingTransactionRepo.save(transaction);

      // Throw error to prevent employee creation/invitation if payment fails
      // Payment must succeed before employee invitation is sent
      throw new Error(`Payment processing failed: ${errorMessage}`);
    }
  }

  /**
   * Confirms employee payment and returns employee data for recreation
   * This is called after successful checkout payment
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
      profile_picture_url?: string;
      cnic_picture_url?: string;
      cnic_back_picture_url?: string;
    };
  }> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    // Retrieve checkout session from Stripe
    const checkoutSession = await this.stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ['payment_intent'],
    });

    // Verify payment is successful
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

    // Get employee data from metadata
    const metadata = checkoutSession.metadata;
    if (!metadata || !metadata.employee_email) {
      throw new BadRequestException('Employee data not found in payment metadata');
    }

    // Verify tenant matches
    if (metadata.tenant_id !== tenantId) {
      throw new BadRequestException('Tenant ID mismatch');
    }

    // Extract employee data from metadata
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
      profile_picture_url: metadata.profile_picture_url || undefined,
      cnic_picture_url: metadata.cnic_picture_url || undefined,
      cnic_back_picture_url: metadata.cnic_back_picture_url || undefined,
    };

    // Check if transaction already exists (FAILED or PENDING) for this employee email
    // We check by employee_email in metadata to find the failed transaction
    const existingTransactions = await this.billingTransactionRepo.find({
      where: {
        tenant_id: tenantId,
        type: BillingTransactionType.EMPLOYEE_CREATION,
      },
      order: { created_at: 'DESC' },
    });

    // Find existing transaction by employee email in metadata
    const existingTransaction = existingTransactions.find(
      (t) =>
        t.metadata &&
        typeof t.metadata === 'object' &&
        (t.metadata as any).employee_email === metadata.employee_email &&
        (t.status === BillingTransactionStatus.FAILED || t.status === BillingTransactionStatus.PENDING),
    );

    let transaction;
    if (existingTransaction) {
      // Update existing FAILED/PENDING transaction to SUCCESS
      transaction = existingTransaction;
      transaction.status = BillingTransactionStatus.SUCCESS;
      transaction.stripe_customer_id = checkoutSession.customer as string;
      transaction.stripe_charge_id = checkoutSession.payment_intent as string;
      transaction.description = `Employee creation charge for ${metadata.employee_name} (${metadata.employee_email})`;
      transaction.error_message = null; // Clear error message
      transaction.metadata = {
        ...(transaction.metadata && typeof transaction.metadata === 'object' ? transaction.metadata : {}),
        checkout_session_id: checkoutSessionId,
        employee_email: metadata.employee_email,
        employee_name: metadata.employee_name,
      };
      this.logger.log(
        `Updating existing transaction (${existingTransaction.status}) to SUCCESS for checkout session: ${checkoutSessionId}`,
      );
    } else {
      // Create new transaction only if it doesn't exist
      transaction = this.billingTransactionRepo.create({
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
      this.logger.log(`Creating new transaction for checkout session: ${checkoutSessionId}`);
    }
    await this.billingTransactionRepo.save(transaction);

    this.logger.log(
      `Payment confirmed for employee creation: ${metadata.employee_email} (checkout session: ${checkoutSessionId})`,
    );

    // Create employee and send invitation
    if (this.employeeService) {
      try {
        const activatedEmployee = await this.employeeService.activateAfterPayment(tenantId, employeeData);

        // Update transaction with employee_id
        transaction.employee_id = activatedEmployee.id;
        await this.billingTransactionRepo.save(transaction);

        this.logger.log(`Employee activated and invitation sent after payment: ${activatedEmployee.id}`);
        return {
          success: true,
          paymentConfirmed: true,
          paymentStatus: checkoutSession.payment_status || checkoutSession.status,
          paymentIntentId:
            typeof checkoutSession.payment_intent === 'string'
              ? checkoutSession.payment_intent
              : checkoutSession.payment_intent?.id,
          checkoutSessionId: checkoutSessionId,
          employeeId: activatedEmployee.id,
          message: 'Payment confirmed successfully. Employee activated and invitation email sent',
        };
      } catch (error) {
        this.logger.error(
          `Failed to create employee after payment: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Still return success for payment, but log employee creation failure
        return {
          success: true,
          employeeData,
          warning: 'Payment successful but employee creation failed. Please contact support.',
        };
      }
    }

    return {
      success: true,
      employeeData,
    };
  }

  /**
   * Get billing transactions for a tenant
   */
  async getTransactionsByTenant(
    tenantId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{
    transactions: BillingTransaction[];
    total: number;
  }> {
    const [transactions, total] = await this.billingTransactionRepo.findAndCount({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { transactions, total };
  }

  /**
   * Get a specific billing transaction by ID
   */
  async getTransactionById(transactionId: string, tenantId: string): Promise<BillingTransaction | null> {
    return this.billingTransactionRepo.findOne({
      where: { id: transactionId, tenant_id: tenantId },
    });
  }
}
