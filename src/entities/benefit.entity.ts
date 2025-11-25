import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Tenant } from "./tenant.entity";
import { EmployeeBenefit } from "./employee-benefit.entity";

@Entity("benefits")
export class Benefit {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "varchar", length: 100 })
  type: string;

  @Column({ type: "text", name: "eligibility_criteria", nullable: true })
  eligibilityCriteria: string;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: "active" | "inactive";

  @Column({ type: "uuid" })
  tenant_id: string;

  @Column({ type: "uuid", name: "created_by" })
  createdBy: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.benefits, { 
    nullable: false,
    onDelete: 'RESTRICT' // Prevent hard delete, use soft delete instead
  })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @OneToMany(
    () => EmployeeBenefit,
    (employeeBenefit) => employeeBenefit.benefit,
  )
  employeeBenefits: EmployeeBenefit[];
}
