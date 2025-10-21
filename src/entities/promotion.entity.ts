import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { Tenant } from "./tenant.entity";
import { Employee } from "./employee.entity";

@Entity("promotions")
export class Promotion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  employee_id: string;

  @Column()
  previousDesignation: string;

  @Column()
  newDesignation: string;

  @Column({ type: "date", nullable: true })
  effectiveDate: Date;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ default: "pending" })
  status: "pending" | "approved" | "rejected";

  @Column({ type: "text", nullable: true })
  remarks: string;

  @Column()
  tenant_id: string;

  @ManyToOne(() => Employee, (employee) => employee.employeePromotions, {
    nullable: false,
  })
  @JoinColumn({ name: "employee_id" })
  employee: Employee;

  @ManyToOne(() => Tenant, (tenant) => tenant.employeePromotions, {
    nullable: false,
  })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @CreateDateColumn()
  createdAt: Date;
}
