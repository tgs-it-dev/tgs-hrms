import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';
import { NotificationType, NotificationStatus, NotificationAction } from '../common/constants/enums';

@Index(['user_id'])
@Index(['tenant_id'])
@Index(['status'])
@Index(['type'])
@Index(['user_id', 'status'])
@Index(['tenant_id', 'user_id'])
@Index(['action'])
@Index(['related_entity_type', 'related_entity_id'])
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  sender_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sender_id' })
  sender: User | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  sender_role: string | null;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 20 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  action: NotificationAction | null;

  @Column({ type: 'varchar', length: 20, default: NotificationStatus.UNREAD })
  status: NotificationStatus;

  /** e.g. 'leave', 'attendance' - for click-to-redirect */
  @Column({ type: 'varchar', length: 32, nullable: true })
  related_entity_type: string | null;

  /** e.g. leave_id, attendance_id - for deep link */
  @Column({ type: 'uuid', nullable: true })
  related_entity_id: string | null;

  @Column({ type: 'boolean', default: false })
  is_system: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
