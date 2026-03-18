import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Team } from './team.entity';
import { Tenant } from './tenant.entity';
import { TaskStatus } from '../common/constants/enums';
import { TaskHistory } from './task-history.entity';

@Index(['assigned_to'])
@Index(['team_id'])
@Index(['tenant_id'])
@Index(['status'])
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_to: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedEmployee: Employee | null;

  @Column({ type: 'uuid', nullable: true })
  team_id: string | null;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ type: 'uuid' })
  created_by: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'created_by' })
  creator: Employee;

  @Column({ type: 'varchar', default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ type: 'timestamptz', nullable: true })
  deadline: Date | null;

  @Column({ type: 'int', nullable: true })
  priority: number | null; // 1 = Low, 2 = Medium, 3 = High

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => TaskHistory, (taskHistory) => taskHistory.task)
  history: TaskHistory[];
}

