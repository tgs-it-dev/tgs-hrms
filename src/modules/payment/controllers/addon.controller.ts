import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { TenantId } from '../../../common/decorators/company.deorator';
import { AddonPaymentService } from '../services/addon-payment.service';
import { CreateAddonOrderDto } from '../dto/create-addon-order.dto';
import { CaptureAddonOrderDto } from '../dto/capture-addon-order.dto';

@ApiTags('Payments - Addons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('payments/addons')
export class AddonController {
  constructor(private readonly addonService: AddonPaymentService) {}

  /**
   * Creates a PayPal order for purchasing additional employee slots.
   * Returns a PayPal approval URL; the frontend must redirect the user there.
   * Only available when `addon_feature_enabled` is true on the tenant's plan.
   */
  @Post('create-order')
  @HttpCode(HttpStatus.CREATED)
  createOrder(
    @Body() dto: CreateAddonOrderDto,
    @TenantId() tenantId: string,
  ) {
    return this.addonService.createAddonOrder(tenantId, dto);
  }

  /**
   * Captures the approved PayPal order.
   * Call once the user returns from the PayPal approval URL.
   * Idempotent — safe to call multiple times for the same order.
   */
  @Post('capture')
  @HttpCode(HttpStatus.OK)
  captureOrder(
    @Body() dto: CaptureAddonOrderDto,
    @TenantId() tenantId: string,
  ) {
    return this.addonService.captureAddonOrder(tenantId, dto);
  }
}
