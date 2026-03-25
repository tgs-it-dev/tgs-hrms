import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BillingTransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum BillingTransactionType {
  EMPLOYEE_CREATION = 'employee_creation',
}

@Entity('billing_transactions')
@Index(['tenant_id'])
@Index(['status'])
@Index(['created_at'])
export class BillingTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 50 })
  type: BillingTransactionType;

  @Column({ type: 'varchar', length: 20 })
  status: BillingTransactionStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', nullable: true })
  stripe_charge_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_customer_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  employee_id: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

