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
import { AttendanceType, CheckInApprovalStatus } from '../common/constants/enums';

@Index(['user_id'])
@Index(['timestamp'])
@Index(['user_id', 'timestamp'])
@Index(['type'])
@Index(['approval_status'])
@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, (user) => user.attendances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  type: AttendanceType;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Approval fields (only for CHECK_IN type)
  @Column({ 
    type: 'varchar', 
    length: 20, 
    nullable: true,
    default: CheckInApprovalStatus.PENDING 
  })
  approval_status: CheckInApprovalStatus | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: User;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'text', nullable: true })
  approval_remarks: string | null;

  /**
   * Indicates if the check-in/check-out was made within the threshold distance
   * but outside the strict geofence boundary.
   */
  @Column({ type: 'boolean', default: false })
  near_boundary: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
