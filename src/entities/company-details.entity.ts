import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { SignupSession } from './signup-session.entity';

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

  @Column({ type: 'int' })
  seats: number;

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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}


