import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { User } from './user.entity';
import { OvertimeStatus } from '../common/constants/enums';

@Entity('overtime_requests')
@Index(['tenant_id', 'employee_id'])
@Index(['tenant_id', 'status'])
export class Overtime extends TenantBaseEntity {
  @Column({ type: 'uuid' })
  employee_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'employee_id' })
  employee!: User;

  @Column({ type: 'date' })
  start_date!: Date;

  @Column({ type: 'date' })
  end_date!: Date;

  @Column({ type: 'decimal', precision: 4, scale: 2 })
  hours!: number;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar', length: 32, default: OvertimeStatus.PENDING })
  status!: OvertimeStatus;

  @Column({ type: 'jsonb', default: [] })
  attachments!: string[];

  // Soft link to the workflow request (not a typed FK to avoid coupling)
  @Column({ type: 'uuid', nullable: true })
  workflow_request_id!: string | null;
}
