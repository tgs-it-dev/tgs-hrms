import { Injectable, Logger } from '@nestjs/common';
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

  /**
   * Handles billing when an employee is created
   * This method is called via event listener and is decoupled from employee creation logic
   */
  async handleEmployeeCreated(event: EmployeeCreatedEvent): Promise<void> {
    const { tenantId, employeeId, employeeEmail, employeeName } = event;

    this.logger.log(
      `Processing billing for employee creation: ${employeeId} (tenant: ${tenantId})`,
    );

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
        throw new Error(
          `Stripe customer ID not found for tenant: ${tenantId}. Company may not be set up for billing.`,
        );
      }

      transaction.stripe_customer_id = companyDetails.stripe_customer_id;

      // If Stripe is not configured, mark as success (for development/testing)
      if (!this.stripe) {
        this.logger.warn(
          `Stripe not configured. Marking transaction as success without actual charge.`,
        );
        transaction.status = BillingTransactionStatus.SUCCESS;
        transaction.description = `${transaction.description} (Stripe not configured - charge skipped)`;
        await this.billingTransactionRepo.save(transaction);
        return;
      }

      // Create charge in Stripe
      const charge = await this.stripe.charges.create({
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
      });

      // Update transaction with success status
      transaction.status = BillingTransactionStatus.SUCCESS;
      transaction.stripe_charge_id = charge.id;

      this.logger.log(
        `Successfully charged $${this.EMPLOYEE_CREATION_CHARGE_AMOUNT} for employee creation: ${employeeId} (Stripe charge: ${charge.id})`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process billing for employee creation: ${employeeId}. Error: ${errorMessage}`,
      );

      // Mark transaction as failed
      transaction.status = BillingTransactionStatus.FAILED;
      transaction.error_message = errorMessage;

      // Note: We don't throw the error here to ensure employee creation is not affected
      // The transaction is saved with failed status for audit purposes
    } finally {
      // Always save the transaction record for audit trail
      await this.billingTransactionRepo.save(transaction);
    }
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
    const [transactions, total] = await this.billingTransactionRepo.findAndCount(
      {
        where: { tenant_id: tenantId },
        order: { created_at: 'DESC' },
        take: limit,
        skip: offset,
      },
    );

    return { transactions, total };
  }

  /**
   * Get a specific billing transaction by ID
   */
  async getTransactionById(
    transactionId: string,
    tenantId: string,
  ): Promise<BillingTransaction | null> {
    return this.billingTransactionRepo.findOne({
      where: { id: transactionId, tenant_id: tenantId },
    });
  }
}

