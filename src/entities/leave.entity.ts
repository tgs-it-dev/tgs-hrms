import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('leaves')
export class Leave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'date' })
  from_date: Date;

  @Column({ type: 'date' })
  to_date: Date;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar', default: 'pending' }) // 'approved', 'rejected', or 'withdrawn'
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
