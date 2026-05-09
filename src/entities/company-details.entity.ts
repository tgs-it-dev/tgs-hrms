import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { SignupSession } from './signup-session.entity';
import { Tenant } from './tenant.entity';

@Index(['domain'], { unique: true })
@Entity('company_details')
export class CompanyDetails {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_name: string;

  @Column({ type: 'varchar' })
  domain: string;

  @Column({ type: 'varchar' })
  plan_id: string;

  @Column({ type: 'boolean', default: false })
  is_paid: boolean;

  /** Active payment provider identifier. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  payment_provider: string | null;

  // ── Legacy Stripe fields (kept for backward compat with existing records) ───
  @Column({ type: 'varchar', nullable: true })
  stripe_customer_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_session_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_payment_intent_id: string | null;

  // ── PayPal fields ────────────────────────────────────────────────────────────
  /** PayPal subscription ID (I-...) returned after subscription creation. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  paypal_subscription_id: string | null;

  /** PayPal order ID for one-time payments. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  paypal_order_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  logo_url: string | null;

  @Column({ type: 'uuid', nullable: true })
  signup_session_id: string | null;

  @OneToOne(() => SignupSession, (session) => session.companyDetails, {
    nullable: true,
  })
  @JoinColumn({ name: 'signup_session_id' })
  signupSession: SignupSession | null;

  @Column({ type: 'uuid', nullable: true })
  tenant_id: string | null;

  @ManyToOne(() => Tenant, (tenant) => tenant.departments, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
