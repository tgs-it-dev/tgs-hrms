import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
import { OrgMemberRole } from '../common/constants/enums';

/**
 * Represents a pending invitation to join an organisation.
 *
 * One-time use: `used_at` is NULL until the invite is accepted; a second
 * attempt after acceptance returns HTTP 410 Gone.
 *
 * Expiry: invites are valid for 24 hours after creation; attempting to
 * accept an expired (but unused) invite returns a user-friendly 400.
 */
@Index(['token'], { unique: true })
@Index(['org_id'])
@Entity('org_invites')
export class OrgInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The org (tenant) the invitee is being added to. */
  @Column({ type: 'uuid' })
  org_id: string;

  /** Email address the invitation was sent to. */
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** Role the invitee will receive on acceptance. */
  @Column({
    type: 'enum',
    enum: OrgMemberRole,
    enumName: 'member_role',
  })
  role: OrgMemberRole;

  /**
   * Cryptographically-random hex token (64 chars / 32 bytes).
   * Embedded in the invite URL: `/accept-invitation?token=<token>`.
   */
  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  /** Invite becomes invalid after this timestamp (created_at + 24 h). */
  @Column({ type: 'timestamptz' })
  expires_at: Date;

  /**
   * Set to the acceptance timestamp once the invite is consumed.
   * NULL = not yet used.  Non-NULL = already used → 410 Gone.
   */
  @Column({ type: 'timestamptz', nullable: true })
  used_at: Date | null;

  /** The org member who created this invite (optional, for audit). */
  @Column({ type: 'uuid', nullable: true })
  invited_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  org: Tenant;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invited_by' })
  inviter: User | null;
}
