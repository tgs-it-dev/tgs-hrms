import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Department } from './department.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Department, (department) => department.tenant)
  departments: Department[];
} 