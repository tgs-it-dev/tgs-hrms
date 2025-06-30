import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity'; // adjust path as needed

export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STAFF })
  role: UserRole;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
