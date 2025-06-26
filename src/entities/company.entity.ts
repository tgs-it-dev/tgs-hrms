// src/entities/company.entity.ts   ← put it where you keep shared entities
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Department } from './department.entity';

@Entity()
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // purely for navigation; not required for Department CRUD
  @OneToMany(() => Department, (d) => d.tenant)
  departments: Department[];
}
