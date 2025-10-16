import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { BadRequestException } from '@nestjs/common';
import { Query } from '@nestjs/common';
@ApiTags('Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  
  @Get('prices')
  async getStripePrices(@Query('ids') ids: string) {
    if (!ids) {
      throw new BadRequestException('ids parameter is required');
    }

    const priceIds = ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (priceIds.length === 0) {
      throw new BadRequestException('No valid price IDs provided');
    }

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
