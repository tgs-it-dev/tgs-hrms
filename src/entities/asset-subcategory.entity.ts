import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { AssetCategory } from './asset-category.entity';

@Entity('asset_subcategories')
export class AssetSubcategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'uuid' })
  category_id: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => AssetCategory, (category) => category.subcategories, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category?: AssetCategory;

  @ManyToOne(() => Tenant, (tenant) => tenant.id, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
