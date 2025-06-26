import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from './company.entity';

@Entity()
@Index(['tenantId', 'name'], { unique: true }) // name must be unique **within** a tenant
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- tenant scope ----------------------------------------------------------
  @Column({ type: 'uuid' })
  tenantId: string; // redundant but lets us filter fast w/out a join

  @ManyToOne(() => Company, (company) => company.departments, {
    onDelete: 'CASCADE',
    eager: false,
  })
  tenant: Company;
  // --------------------------------------------------------------------------

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
