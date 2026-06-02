import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  NotificationEmailType,
  NotificationLogStatus,
} from '../common/constants/enums';

@Index(['tenant_id'])
@Index(['recipient_user_id'])
@Index(['type'])
@Index(['status'])
@Entity('notifications_log')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  tenant_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  recipient_user_id: string | null;

  @Column({ type: 'varchar', length: 320 })
  recipient_email: string;

  @Column({ type: 'varchar', length: 32 })
  type: NotificationEmailType;

  @Column({ type: 'varchar', length: 16 })
  status: NotificationLogStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  sent_at: Date;
}
