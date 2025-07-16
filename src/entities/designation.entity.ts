import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Department } from './department.entity';

@Entity()
@Index(['departmentId', 'title'], { unique: true }) 
export class Designation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  departmentId: string;

  @ManyToOne(() => Department, (department) => department.designations, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ length: 100 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
