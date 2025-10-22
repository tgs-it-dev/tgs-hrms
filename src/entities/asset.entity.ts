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
import { AssetStatus } from '../common/constants/enums';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  category: string;

  @Column({ type: 'uuid', nullable: true })
  subcategory_id: string | null;

  @Column({ type: 'varchar', length: 30, default: AssetStatus.AVAILABLE })
  status: AssetStatus;

  @Column({ type: 'uuid', nullable: true })
  assigned_to: string | null;

  @Column({ type: 'date', nullable: true })
  purchase_date: string | null;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedToUser?: User | null;

  @ManyToOne(() => AssetSubcategory, (subcategory) => subcategory.id, { nullable: true })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory?: AssetSubcategory | null;

  @ManyToOne(() => Tenant, (tenant) => tenant.id, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}


