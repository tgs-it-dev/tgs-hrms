import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Department } from './department.entity';
import { Employee } from './employee.entity';

@Entity('designations')
export class Designation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'uuid' })
  department_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Department, (department) => department.designations, { 
    nullable: false,
    onDelete: 'CASCADE' // When department is deleted, designations should also be deleted
  })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @OneToMany(() => Employee, (employee) => employee.designation)
  employees: Employee[];
}
