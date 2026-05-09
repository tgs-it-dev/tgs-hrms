import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PaymentStatus } from '../modules/payment/enums/payment-status.enum';

/**
 * Tracks one-time employee-slot purchases.
 * Kept in public schema so the addon feature toggle (plan-level) can be
 * evaluated centrally without per-tenant schema switching.
 */
@Entity('addon_purchases')
@Index(['tenant_id'])
@Index(['payment_status'])
@Index(['paypal_order_id'], { unique: true, where: '"paypal_order_id" IS NOT NULL' })
export class AddonPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'int', default: 0 })
  employee_count: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING })
  payment_status: PaymentStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paypal_order_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paypal_capture_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
