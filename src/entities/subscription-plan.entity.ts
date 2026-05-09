import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Legacy Stripe price ID — kept for backward compat with existing records. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  stripePriceId: string | null;

  /** PayPal billing plan ID (P-...) configured in the PayPal dashboard. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  paypal_plan_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  billing_cycle: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  allows_addons: boolean;

  /** When false, the addon (employee-slot) purchase endpoint rejects requests for this plan. */
  @Column({ type: 'boolean', default: false })
  addon_feature_enabled: boolean;

  @Column({ type: 'int', nullable: true })
  max_employees: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
