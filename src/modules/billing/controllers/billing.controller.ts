import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantId } from '../../../common/decorators/company.deorator';
import { BillingService } from '../services/billing.service';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
}

