import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('asset_subcategories')
export class AssetSubcategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.id, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
