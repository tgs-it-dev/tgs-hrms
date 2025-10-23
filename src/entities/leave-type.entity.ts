import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';
import { Leave } from './leave.entity';

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  maxDaysPerYear: number;

  @Column({ type: 'boolean', default: false })
  carryForward: boolean;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @OneToMany(() => Leave, (leave) => leave.leaveType)
  leaves: Leave[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
