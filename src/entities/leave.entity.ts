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
import { LeaveType } from './leave-type.entity';
import { LeaveStatus } from '../common/constants/enums';
import { Tenant } from './tenant.entity';

@Entity('leaves')
export class Leave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'employeeId' })
  employee: User;

  @Index()
  @Column({ type: 'uuid' })
  leaveTypeId: string;

  @ManyToOne(() => LeaveType)
  @JoinColumn({ name: 'leaveTypeId' })
  leaveType: LeaveType;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'int' })
  totalDays: number;

  @Column({ type: 'text' })
  reason: string;

  @Index()
  @Column({ type: 'varchar', default: LeaveStatus.PENDING }) 
  status: LeaveStatus;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approvedBy' })
  approver: User;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  managerRecommendation: 'approve' | 'reject' | null;

  @Column({ type: 'uuid', nullable: true })
  recommendedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recommendedBy' })
  recommender: User;

  @Column({ type: 'timestamp', nullable: true })
  recommendedAt: Date;

  @Column({ type: 'text', nullable: true })
  managerRemarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.leaves, { 
    nullable: false,
    onDelete: 'RESTRICT' // Prevent hard delete, use soft delete instead
  })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;
}
