import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Stores active refresh token sessions.
 * Each login creates one record; the record id (UUID) is embedded
 * in the refresh JWT as the `jti` claim, enabling O(1) lookup and
 * per-session revocation without scanning the users table.
 */
@Entity("user_tokens")
@Index(["user_id", "is_revoked"])
export class UserToken {
  /** Matches the `jti` claim inside the signed refresh JWT. */
  @PrimaryColumn({ type: "uuid" })
  id: string;

  @Column({ type: "uuid" })
  user_id: string;

  /** 'web' | 'mobile' | 'ios' | 'android' — set by the client on login. */
  @Column({ type: "varchar", length: 20, nullable: true })
  platform: string | null;

  /** Free-form device/browser info passed by the client. */
  @Column({ type: "text", nullable: true })
  device_info: string | null;

  /** IP address of the login request. */
  @Column({ type: "varchar", length: 45, nullable: true })
  ip_address: string | null;

  @Column({ type: "timestamptz" })
  expires_at: Date;

  @Column({ type: "timestamptz", nullable: true })
  last_used_at: Date | null;

  @Column({ type: "boolean", default: false })
  is_revoked: boolean;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
