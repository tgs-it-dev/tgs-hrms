import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Index(['tenant_id'])
@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /**
   * Shift start time in "HH:mm" 24-hour format (e.g. "09:00", "22:00").
   */
  @Column({ type: 'varchar', length: 5 })
  start_time: string;

  /**
   * Shift end time in "HH:mm" 24-hour format.
   * When end_time <= start_time the shift crosses midnight
   * (e.g. start=22:00 end=07:00 → employee works overnight).
   */
  @Column({ type: 'varchar', length: 5 })
  end_time: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
