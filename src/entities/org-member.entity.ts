import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';
import { OrgMemberRole } from '../common/constants/enums';

/**
 * Represents a user's membership in an organisation (tenant).
 *
 * member_role is stored as a native PostgreSQL ENUM type (`member_role`)
 * created by migration 1773000000003. TypeORM's `enumName` option ensures
 * the column references the named PG type rather than an anonymous CHECK
 * constraint, so invalid values are rejected by PostgreSQL at the wire level.
 */
@Index(['org_id', 'user_id'], { unique: true })
@Index(['user_id'])
@Entity('org_members')
export class OrgMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  /**
   * Native PostgreSQL ENUM column.
   *
   * The `type: 'enum'` + `enumName: 'member_role'` combination tells TypeORM
   * to use the pre-existing CREATE TYPE rather than generating an inline
   * VARCHAR with a CHECK constraint. PostgreSQL therefore rejects any value
   * not in ('owner', 'admin', 'member') at the database level.
   */
  @Column({
    type: 'enum',
    enum: OrgMemberRole,
    enumName: 'member_role',
  })
  member_role: OrgMemberRole;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  org: Tenant;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
