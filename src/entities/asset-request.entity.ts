import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';
import { AssetSubcategory } from './asset-subcategory.entity';
import { AssetRequestStatus } from '../common/constants/enums';

@Entity('asset_requests')
export class AssetRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  asset_category: string;

  @Column({ type: 'uuid', nullable: true })
  subcategory_id: string | null;

  @Column({ type: 'uuid' })
  requested_by: string;

  @Column({ type: 'varchar', length: 20, default: AssetRequestStatus.PENDING })
  status: AssetRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'date' })
  requested_date: string;

  @Column({ type: 'date', nullable: true })
  approved_date: string | null;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (user) => user.id, { nullable: false })
  @JoinColumn({ name: 'requested_by' })
  requestedByUser?: User;


  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  
  @ManyToOne(() => User, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser?: User | null;

  @ManyToOne(() => AssetSubcategory, (subcategory) => subcategory.id, { nullable: true })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory?: AssetSubcategory | null;

  @ManyToOne(() => Tenant, (tenant) => tenant.id, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
