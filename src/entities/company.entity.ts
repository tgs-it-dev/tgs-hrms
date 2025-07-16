import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Department } from './department.entity';
import { User } from './user.entity';
import { Employee } from './employee.entity'; 

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

  @OneToMany(() => Department, (d) => d.tenant)
  departments: Department[];

  @OneToMany(() => User, (user) => user.company)
  users: User[];

  @OneToMany(() => Employee, (employee) => employee.tenant) 
  employees: Employee[];
}
