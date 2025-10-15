import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Benefit } from "./benefit.entity";
import { Tenant } from "./tenant.entity";
import { Employee } from "./employee.entity";

@Entity("employee_benefits")
export class EmployeeBenefit {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "employee_id" })
  employeeId: string;

  @Column({ type: "uuid", name: "benefit_id" })
  benefitId: string;

  @Column({ type: "date", name: "start_date" })
  startDate: Date;

  @Column({ type: "date", name: "end_date", nullable: true })
  endDate: Date | null;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: "active" | "expired" | "cancelled";

  @Column({ type: "uuid", name: "assigned_by" })
  assignedBy: string;

  @Column({ type: "uuid" })
  tenant_id: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => Employee, (employee) => employee.employeeBenefits, {
    nullable: false,
  })
  @JoinColumn({ name: "employee_id" })
  employee: Employee;

  @ManyToOne(() => Benefit, (benefit) => benefit.employeeBenefits, {
    nullable: false,
  })
  @JoinColumn({ name: "benefit_id" })
  benefit: Benefit;

  @ManyToOne(() => Tenant, (tenant) => tenant.employeeBenefits, {
    nullable: false,
  })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
