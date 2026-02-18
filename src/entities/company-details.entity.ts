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

  @Column({ type: 'varchar', nullable: true })
  stripe_customer_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_session_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_payment_intent_id: string | null;

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
