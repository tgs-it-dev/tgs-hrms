import { Entity, Column, Index, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { WorkflowRequest } from './workflow-request.entity';
import { WorkflowStepStatus } from '../common/constants/enums';

@Entity('workflow_steps')
@Unique(['workflow_request_id', 'step_order'])
@Index(['approver_id'])
@Index(['tenant_id', 'status'])
export class WorkflowStep extends BaseEntity {
  @Column({ type: 'uuid' })
  workflow_request_id: string;

  @ManyToOne(() => WorkflowRequest, (req) => req.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_request_id' })
  workflow_request: WorkflowRequest;

  // Denormalized from parent request for index-based tenant filtering
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'smallint' })
  step_order: number;

  @Column({ type: 'varchar', length: 64 })
  approver_role: string;

  @Column({ type: 'varchar', length: 128 })
  step_label: string;

  @Column({ type: 'varchar', length: 32, default: WorkflowStepStatus.PENDING })
  status: WorkflowStepStatus;

  @Column({ type: 'uuid', nullable: true })
  approver_id: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acted_at: Date | null;
}
