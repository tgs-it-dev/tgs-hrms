import { Entity, Column, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { WorkflowRequestType } from '../common/constants/enums';

@Entity('workflow_configs')
@Unique(['tenant_id', 'request_type', 'step_order'])
@Index(['tenant_id', 'request_type'])
export class WorkflowConfig extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 32 })
  request_type: WorkflowRequestType;

  @Column({ type: 'smallint' })
  step_order: number;

  @Column({ type: 'varchar', length: 64 })
  approver_role: string;

  @Column({ type: 'varchar', length: 128 })
  step_label: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
