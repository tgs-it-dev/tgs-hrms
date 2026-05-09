import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { TenantId } from '../../../common/decorators/company.deorator';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';
import { CancelSubscriptionDto } from '../dto/cancel-subscription.dto';

@ApiTags('Payments - Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('payments/subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionPaymentService) {}

  /** Returns the most recent subscription record for the authenticated tenant. */
  @Get('current')
  getCurrentSubscription(@TenantId() tenantId: string) {
    return this.subscriptionService.getCurrentSubscription(tenantId);
  }

  /** Looks up a subscription by its PayPal subscription ID. */
  @Get(':paypalSubscriptionId')
  getSubscription(
    @Param('paypalSubscriptionId') paypalSubscriptionId: string,
    @TenantId() tenantId: string,
  ) {
    return this.subscriptionService
      .findByPayPalSubscriptionId(paypalSubscriptionId)
      .then((sub) => (sub?.tenant_id === tenantId ? sub : null));
  }

  /** Cancels the tenant's active PayPal subscription. */
  @Post(':paypalSubscriptionId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelSubscription(
    @Param('paypalSubscriptionId') _paypalSubscriptionId: string,
    @Body() dto: CancelSubscriptionDto,
    @TenantId() tenantId: string,
  ) {
    return this.subscriptionService.cancelTenantSubscription(tenantId, dto.reason);
  }
}
