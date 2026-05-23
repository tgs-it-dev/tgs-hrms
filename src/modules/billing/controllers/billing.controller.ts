import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { TenantId } from '../../../common/decorators/company.deorator';
import { BillingService } from '../services/billing.service';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ── Stripe Webhook (no JWT — Stripe signs with its own secret) ─────────────

  @Public()
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body not available. Ensure rawBody: true is set in NestJS bootstrap.',
      );
    }
    const event = this.billingService.constructWebhookEvent(rawBody, signature);
    return this.billingService.handleWebhookEvent(event);
  }

  // ── Authenticated endpoints ────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
  @Get('transactions')
  @ApiOperation({ summary: 'Get billing transactions for the current tenant' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of billing transactions',
  })
  async getTransactions(
    @TenantId() tenantId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.billingService.getTransactionsByTenant(tenantId, limit, offset);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get a specific billing transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the billing transaction',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async getTransaction(
    @TenantId() tenantId: string,
    @Param('id') transactionId: string,
  ) {
    const transaction = await this.billingService.getTransactionById(
      transactionId,
      tenantId,
    );

    if (!transaction) {
      return { message: 'Transaction not found' };
    }

    return transaction;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
  @Post('employees/confirm-payment')
  @ApiOperation({ summary: 'Confirm employee payment after checkout success' })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed, employee will be created',
  })
  async confirmEmployeePayment(
    @TenantId() tenantId: string,
    @Query('checkoutSessionId') checkoutSessionId: string,
  ) {
    if (!checkoutSessionId) {
      throw new BadRequestException(
        'checkoutSessionId is required as query parameter',
      );
    }

    return this.billingService.confirmEmployeePayment(
      checkoutSessionId,
      tenantId,
    );
  }
}
