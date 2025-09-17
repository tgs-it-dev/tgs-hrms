import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepo: Repository<SubscriptionPlan>,
  ) {}

  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlanRepo.find({
      order: {
        created_at: 'ASC',
      },
    });
  }

  async getSubscriptionPlanById(id: string): Promise<SubscriptionPlan | null> {
    return this.subscriptionPlanRepo.findOne({
      where: { id },
    });
  }
}
