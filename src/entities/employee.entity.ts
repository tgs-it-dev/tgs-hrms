import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Designation } from './designation.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  designation_id: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'inactive';

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (user) => user.employees, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Designation, (designation) => designation.employees, { nullable: false })
  @JoinColumn({ name: 'designation_id' })
  designation: Designation;
}
