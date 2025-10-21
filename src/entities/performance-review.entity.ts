import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Employee } from "./employee.entity";
import { Tenant } from "./tenant.entity";

@Entity("performance_reviews")
export class PerformanceReview {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  employee_id: string;

  @Column({ length: 50, comment: "e.g., Q4-2025" })
  cycle: string;

  @Column({ type: "float" })
  overallScore: number;

  @Column({ default: "under_review" })
  status: "under_review" | "completed";

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: "text", nullable: true })
  recommendation: string;

  @Column()
  tenant_id: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(
    () => Employee,
    (employee) => employee.employeePerformanceReviews,
    {
      nullable: false,
    },
  )
  @JoinColumn({ name: "employee_id" })
  employee: Employee;

  @ManyToOne(() => Tenant, (tenant) => tenant.employeePerformanceReviews, {
    nullable: false,
  })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
