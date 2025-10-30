import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { BaseEntity } from './base.entity';

@Entity('payroll_configs')
export class PayrollConfig extends BaseEntity {
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 20, default: 'monthly' })
  salaryCycle: 'monthly' | 'bi-weekly' | 'weekly';

  @Column({ type: 'jsonb', nullable: true })
  basePayComponents: {
    basic: number;
    houseRent?: number;
    medical?: number;
    transport?: number;
    [key: string]: any;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  allowances: {
    type: string;
    amount?: number;
    percentage?: number;
    [key: string]: any;
  }[] | null;

  @Column({ type: 'jsonb', nullable: true })
  deductions: {
    taxPercentage?: number;
    insurancePercentage?: number;
    providentFundPercentage?: number;
    [key: string]: any;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  overtimePolicy: {
    enabled: boolean;
    rateMultiplier?: number;
    maxHoursPerMonth?: number;
    [key: string]: any;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  leaveDeductionPolicy: {
    unpaidLeaveDeduction: boolean;
    halfDayDeduction?: number;
    [key: string]: any;
  } | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;
}

