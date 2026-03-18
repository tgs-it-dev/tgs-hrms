import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";
import { Kpi } from "./kpi.entity";
import { Tenant } from "./tenant.entity";
import { Employee } from "./employee.entity";

@Entity("employee-kpis")
export class EmployeeKpi {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  employee_id: string;

  @Column()
  kpi_id: string;

  @Column({ type: "float", comment: "Percentage value" })
  targetValue: number;

  @Column({ type: "float", comment: "Percentage value" })
  achievedValue: number;

  @Column({
    type: "float",
    comment: "1-5 scale (achieved / target)",
  })
  score: number;

  @Column({ length: 50, comment: "e.g., Q4-2025" })
  reviewCycle: string;

  @Column({ nullable: true, type: "uuid", comment: "manager id" })
  reviewedBy: string;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @Column()
  tenant_id: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Kpi, (kpi) => kpi.employeeKpis, { nullable: false })
  @JoinColumn({ name: "kpi_id" })
  kpi: Kpi;

  @ManyToOne(() => Employee, (employee) => employee.employeeKpis, {
    nullable: false,
    onDelete: 'CASCADE' // When employee is deleted, employee KPIs should also be deleted
  })
  @JoinColumn({ name: "employee_id" })
  employee: Employee;

  @ManyToOne(() => Tenant, (tenant) => tenant.employeeKpis, { 
    nullable: false,
    onDelete: 'RESTRICT' // Prevent hard delete, use soft delete instead
  })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
