import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('flex_request_audit')
@Index(['workflow_request_id'])
@Index(['tenant_id', 'actor_id'])
export class FlexRequestAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workflow_request_id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  actor_id: string;

  @Column({ type: 'varchar', length: 32 })
  from_status: string;

  @Column({ type: 'varchar', length: 32 })
  to_status: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
