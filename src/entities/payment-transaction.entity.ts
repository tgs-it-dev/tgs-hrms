import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { PaymentStatus } from '../modules/payment/enums/payment-status.enum';
import { PaymentType } from '../modules/payment/enums/payment-type.enum';

/**
 * Records every PayPal payment event — subscription payments, addon purchases,
 * refunds, and raw webhook events.  Kept in the public schema alongside
 * payment_subscriptions so webhook processors have a single place to write.
 *
 * The (webhook_event_id) unique constraint is the idempotency key that prevents
 * duplicate processing when PayPal retries a webhook delivery.
 */
@Entity('payment_transactions')
@Index(['tenant_id'])
@Index(['subscription_id'])
@Index(['status'])
@Index(['webhook_event_id'], { unique: true, where: '"webhook_event_id" IS NOT NULL' })
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid', nullable: true })
  subscription_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paypal_order_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paypal_capture_id: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 30 })
  payment_type: PaymentType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  webhook_event_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  webhook_event_type: string | null;

  @Column({ type: 'jsonb', nullable: true })
  raw_response: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;
}
