import { Entity, Column, Index, OneToMany } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { WorkflowStep } from './workflow-step.entity';
import {
  WorkflowRequestType,
  WorkflowRequestStatus,
} from '../common/constants/enums';

@Entity('workflow_requests')
@Index(['tenant_id', 'request_type'])
@Index(['tenant_id', 'requestor_id'])
@Index(['related_entity_id'])
@Index(['tenant_id', 'status'])
export class WorkflowRequest extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 32 })
  request_type: WorkflowRequestType;

  // Polymorphic reference — no typed FK to avoid coupling with Leave/WFH modules
  @Column({ type: 'uuid' })
  related_entity_id: string;

  @Column({ type: 'uuid' })
  requestor_id: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: WorkflowRequestStatus.PENDING,
  })
  status: WorkflowRequestStatus;

  @Column({ type: 'smallint', default: 1 })
  current_step_order: number;

  @Column({ type: 'smallint' })
  total_steps: number;

  @OneToMany(() => WorkflowStep, (step) => step.workflow_request, {
    cascade: true,
  })
  steps: WorkflowStep[];
}
