import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
/**
 * User entity represents an application user.
 * - tenantId: Supports multi-tenant isolation.
 * - role: Used for role-based access control (e.g., admin, staff).
 * - refreshToken: Stores the user's refresh token for session renewal (demo purpose).
 * - resetToken/resetTokenExpiry: Used for password reset flows.
 */
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column()
  tenantId: number;

  @Column()
  role: 'admin' | 'staff';

  @Column({ nullable: true })
  resetToken: string;

  @Column({ nullable: true })
  resetTokenExpiry: Date;

  @Column({ nullable: true })
  refreshToken: string;
}
