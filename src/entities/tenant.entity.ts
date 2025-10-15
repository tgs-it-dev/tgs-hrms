import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { User } from "./user.entity";
import { Department } from "./department.entity";
import { Benefit } from "./benefit.entity";
import { EmployeeBenefit } from "./employee-benefit.entity";

@Entity("tenants")
export class Tenant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  name: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Department, (department) => department.tenant)
  departments: Department[];

  @OneToMany(() => Benefit, (benefit) => benefit.tenant)
  benefits: Benefit[];

  @OneToMany(() => EmployeeBenefit, (employeeBenefit) => employeeBenefit.tenant)
  employeeBenefits: EmployeeBenefit[];
}
