import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Role } from './role.entity';
import { Employee } from './employee.entity';
import { Attendance } from './attendance.entity';
import { Team } from './team.entity';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MANAGER = 'manager',
  HR = 'hr',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  phone: string;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'varchar' })
  first_name: string;

  @Column({ type: 'varchar' })
  last_name: string;

  @Column({ type: 'uuid' })
  role_id: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: 'male' | 'female' | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profile_pic: string | null;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Role, (role) => role.users, { nullable: false })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Tenant, (tenant) => tenant.users, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => Employee, (employee) => employee.user)
  employees: Employee[];

  @OneToMany(() => Attendance, (attendance) => attendance.user)
  attendances: Attendance[];

  @OneToMany(() => Team, (team) => team.manager)
  managedTeams: Team[];

  @Column({ type: 'text', nullable: true })
  refresh_token: string | null;

  @Column({ type: 'text', nullable: true })
  reset_token: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reset_token_expiry: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  first_login_time: Date | null;
}
