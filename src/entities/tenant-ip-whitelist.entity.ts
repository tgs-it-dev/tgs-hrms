import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';

@Entity('tenant_ip_whitelists')
@Index(['tenant_id'])
@Index(['tenant_id', 'ip_address'], { unique: true })
export class TenantIpWhitelist extends BaseEntity {
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 45 })
  ip_address: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
