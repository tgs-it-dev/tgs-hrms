import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { SignupSession } from './signup-session.entity';
import { Tenant } from './tenant.entity';

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

  @Column({ type: 'varchar', nullable: true })
  stripe_customer_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_session_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_payment_intent_id: string | null;

  @Column({ type: 'uuid' })
  signup_session_id: string;

  @OneToOne(() => SignupSession, (session) => session.companyDetails, { nullable: false })
  @JoinColumn({ name: 'signup_session_id' })
  signupSession: SignupSession;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.departments, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
