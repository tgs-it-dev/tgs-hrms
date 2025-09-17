import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';

@ApiTags('Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all subscription plans' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of all subscription plans',
    type: [SubscriptionPlan]
  })
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionService.getAllSubscriptionPlans();
  }
}
