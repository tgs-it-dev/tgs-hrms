import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly stripe?: Stripe;

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepo: Repository<SubscriptionPlan>,
    private readonly configService: ConfigService
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) this.stripe = new Stripe(stripeKey);
    else
      this.logger.warn(
        'STRIPE_SECRET_KEY not configured; prices endpoint will return mocked values.'
      );
  }

  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlanRepo.find({ order: { created_at: 'ASC' } });
  }

  async getSubscriptionPlanById(id: string): Promise<SubscriptionPlan | null> {
    return this.subscriptionPlanRepo.findOne({ where: { id } });
  }

  
  async getStripePricesByPriceIds(priceIds: string[]): Promise<any[]> {
    if (!this.stripe) {
      
      return priceIds.map((priceId, index) => ({
        priceId,
        currency: 'usd',
        unit_amount: [900, 1900, 3000][index] || 1000, 
        interval: 'month',
      }));
    }

    try {
    
      const prices = await Promise.all(
        priceIds.map(async (priceId) => {
          const price = await this.stripe!.prices.retrieve(priceId);
          return {
            priceId,
            currency: price.currency?.toUpperCase() || 'USD',
            unit_amount: price.unit_amount || 0,
            interval: price.recurring?.interval || 'month',
          };
        })
      );
      return prices;
    } catch (error) {
      this.logger.error('Error fetching Stripe prices:', error);
      throw new BadRequestException('Failed to fetch Stripe prices');
    }
  }
}
