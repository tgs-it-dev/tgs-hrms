import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { Public } from '../../common/decorators/public.decorator';
import { StripePricesQueryDto } from './dto/stripe-prices-query.dto';

@ApiTags('Subscription Plans')
@Controller('subscription-plans')
@Public()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('prices')
  @ApiOperation({ summary: 'Get Stripe prices by price IDs (comma-separated)' })
  @ApiResponse({ status: 200, description: 'List of Stripe price details' })
  @ApiResponse({ status: 400, description: 'Missing or invalid ids parameter' })
  async getStripePrices(@Query() query: StripePricesQueryDto) {
    const priceIds = query.ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    return this.subscriptionService.getStripePricesByPriceIds(priceIds);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscription plans' })
  @ApiResponse({
    status: 200,
    description: 'List of all subscription plans',
    type: [SubscriptionPlan],
  })
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionService.getAllSubscriptionPlans();
  }
}
