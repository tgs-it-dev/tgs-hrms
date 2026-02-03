/**
 * Announcement Entity
 * Tenant-scoped announcements for holidays, events, policies, etc.
 */

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { User } from './user.entity';
import {
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
} from '../common/constants/enums';

@Entity('announcements')
@Index(['tenant_id', 'status'])
@Index(['tenant_id', 'category'])
@Index(['tenant_id', 'scheduled_at'])
export class Announcement extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: AnnouncementCategory.GENERAL,
  })
  category: AnnouncementCategory;

  @Column({
    type: 'varchar',
    length: 10,
    default: AnnouncementPriority.MEDIUM,
  })
  priority: AnnouncementPriority;

  @Column({
    type: 'varchar',
    length: 15,
    default: AnnouncementStatus.DRAFT,
  })
  status: AnnouncementStatus;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'int', default: 0 })
  recipient_count: number;

  @Column({ type: 'uuid' })
  created_by: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator: User;
}
