import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BillingService } from '../services/billing.service';
import { EmployeeCreatedEvent } from '../events/employee-created.event';

/**
 * Event listener for billing-related events
 * This listener is decoupled from the employee creation logic
 */
@Injectable()
export class BillingListener {
  private readonly logger = new Logger(BillingListener.name);

  constructor(private readonly billingService: BillingService) {}

  @OnEvent('employee.created')
  async handleEmployeeCreated(event: EmployeeCreatedEvent): Promise<void> {
    this.logger.log(
      `Received employee.created event for employee: ${event.employeeId} (tenant: ${event.tenantId})`,
    );

    try {
      await this.billingService.handleEmployeeCreated(event);
    } catch (error) {
      // Log error but don't throw - billing failures should not affect employee creation
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error processing billing for employee creation: ${errorMessage}`,
      );
    }
  }
}

