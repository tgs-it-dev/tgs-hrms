import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AssetRequest } from './asset-request.entity';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';

@Index(['asset_request_id'])
@Index(['commented_by'])
@Index(['tenant_id'])
@Entity('asset_comments')
export class AssetComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  asset_request_id: string;

  @ManyToOne(() => AssetRequest, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_request_id' })
  assetRequest: AssetRequest;

  @Column({ type: 'uuid' })
  commented_by: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'commented_by' })
  commentedByUser: User;

  @Column({ type: 'text' })
  comment: string;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

