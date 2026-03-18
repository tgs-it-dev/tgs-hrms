import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Task } from './task.entity';
import { Employee } from './employee.entity';
import { TaskStatus } from '../common/constants/enums';

@Index(['task_id'])
@Index(['changed_by'])
@Entity('task_history')
export class TaskHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  task_id: string;

  @ManyToOne(() => Task, (task) => task.history, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ type: 'varchar' })
  previous_status: TaskStatus;

  @Column({ type: 'varchar' })
  new_status: TaskStatus;

  @Column({ type: 'uuid' })
  changed_by: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'changed_by' })
  changedByEmployee: Employee;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

