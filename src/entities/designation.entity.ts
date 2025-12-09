import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Department } from './department.entity';
import { Employee } from './employee.entity';
import { Tenant } from './tenant.entity';

@Index(['tenant_id'])
@Index(['department_id'])
@Index(['tenant_id', 'department_id'])
@Entity('designations')
export class Designation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'uuid' })
  department_id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Department, (department) => department.designations, {
    nullable: false,
    onDelete: 'CASCADE', // When department is deleted, designations should also be deleted
  })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @ManyToOne(() => Tenant, (tenant) => tenant.designations, {
    nullable: false,
    onDelete: 'RESTRICT', // Prevent hard delete of tenant while designations exist
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => Employee, (employee) => employee.designation)
  employees: Employee[];
}
