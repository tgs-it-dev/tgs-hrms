import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { CompanyDetails } from './company-details.entity';

@Entity('signup_sessions')
export class SignupSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  password_hash: string;

  @Column({ type: 'varchar' })
  first_name: string;

  @Column({ type: 'varchar' })
  last_name: string;

  @Column({ type: 'varchar' })
  phone: string;

  @Column({ type: 'varchar', length: 30, default: 'personal_completed' })
  status: 'personal_completed' | 'company_completed' | 'payment_completed' | 'completed';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => CompanyDetails, (company) => company.signupSession)
  companyDetails: CompanyDetails;
}
