import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('timesheets')
@Index(['user_id', 'end_time'])
export class Timesheet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'timestamptz' })
  start_time: Date;

  @Column({ type: 'timestamptz', nullable: true })
  end_time: Date | null;

  @Column({ type: 'float', nullable: true })
  duration_hours: number | null;

  @Column({ type: 'varchar', nullable: true })
  employee_full_name: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}


