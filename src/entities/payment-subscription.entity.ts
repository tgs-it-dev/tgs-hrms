import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SubscriptionStatus } from '../modules/payment/enums/subscription-status.enum';

/**
 * Stores PayPal subscription records in the public (shared) schema.
 * Billing is a SaaS-level concern — keeping it in the public schema ensures
 * webhooks can resolve tenants without per-tenant schema switching, and avoids
 * duplication across provisioned schemas.
 */
@Entity('payment_subscriptions')
@Index(['tenant_id'])
@Index(['paypal_subscription_id'], { unique: true, where: '"paypal_subscription_id" IS NOT NULL' })
@Index(['status'])
export class PaymentSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paypal_subscription_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paypal_plan_id: string | null;

  @Column({ type: 'varchar', length: 20, default: SubscriptionStatus.APPROVAL_PENDING })
  status: SubscriptionStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'paypal' })
  payment_provider: string;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  next_billing_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
