import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { User } from './user.entity';
import { WfhStatus } from '../common/constants/enums';

@Entity('wfh_requests')
@Index(['tenant_id', 'employee_id'])
@Index(['tenant_id', 'status'])
export class Wfh extends TenantBaseEntity {
  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  @Column({ type: 'date' })
  wfh_date: Date;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 32, default: WfhStatus.PENDING })
  status: WfhStatus;

  // Soft link to the workflow request (not a typed FK to avoid coupling)
  @Column({ type: 'uuid', nullable: true })
  workflow_request_id: string | null;
}
