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
import { Department } from './department.entity';

@Entity()
@Index(['departmentId', 'title'], { unique: true })
export class Designation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  departmentId: string;

  @ManyToOne(() => Department, (dept) => dept.designations, {
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