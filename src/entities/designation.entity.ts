import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from './department.entity';
import { Company } from './company.entity';

@Entity('designations')
@Index(['departmentId', 'title'], { unique: true })      // ⬅️ unique per‑department
export class Designation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  title: string;

  /* ─────────── Tenant (Company) ─────────── */
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'tenantId' })
  tenant: Company;

  /* ─────────── Parent Department ─────────── */
  @Column({ type: 'uuid' })
  departmentId: string;

  @ManyToOne(() => Department, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
