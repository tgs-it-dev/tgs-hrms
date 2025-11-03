import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Employee } from './employee.entity';
import { User } from './user.entity';
import { BaseEntity } from './base.entity';

@Entity('payroll_records')
export class PayrollRecord extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Index()
  @Column({ type: 'int' })
  month: number;

  @Index()
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  grossSalary: number;

  @Column({ type: 'jsonb', nullable: true })
  salaryBreakdown: {
    baseSalary: number;
    allowances: Array<{ type: string; amount: number }>;
    totalAllowances: number;
    [key: string]: any;
  } | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalDeductions: number;

  @Column({ type: 'jsonb', nullable: true })
  deductionsBreakdown: {
    tax: number;
    insurance: number;
    leaveDeductions: number;
    otherDeductions: Array<{ type: string; amount: number }>;
    [key: string]: any;
  } | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  bonuses: number;

  @Column({ type: 'jsonb', nullable: true })
  bonusesBreakdown: {
    performanceBonus?: number;
    overtimeBonus?: number;
    otherBonuses?: Array<{ type: string; amount: number }>;
    [key: string]: any;
  } | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  netSalary: number;

  @Column({ type: 'int', nullable: true })
  workingDays: number | null;

  @Column({ type: 'int', nullable: true })
  daysPresent: number | null;

  @Column({ type: 'int', nullable: true })
  daysAbsent: number | null;

  @Column({ type: 'int', nullable: true })
  paidLeaves: number | null;

  @Column({ type: 'int', nullable: true })
  unpaidLeaves: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  overtimeHours: number | null;

  @Column({ type: 'uuid' })
  generated_by: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'generated_by' })
  generatedBy: User;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'approved' | 'paid' | 'rejected';

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;
}

