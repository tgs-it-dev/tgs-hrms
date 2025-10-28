import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { User } from "./user.entity";
import { Department } from "./department.entity";
import { Benefit } from "./benefit.entity";
import { EmployeeBenefit } from "./employee-benefit.entity";
import { Kpi } from "./kpi.entity";
import { EmployeeKpi } from "./employee-kpi.entity";
import { PerformanceReview } from "./performance-review.entity";
import { Promotion } from "./promotion.entity";
import { Asset } from "./asset.entity";
import { Leave } from "./leave.entity";

@Entity("tenants")
export class Tenant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", default: "active" })
  status: "active" | "suspended";

  @Column({ type: "boolean", default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: "timestamp", nullable: true })
  deleted_at: Date | null;

  // --- Relations ---
  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Department, (department) => department.tenant)
  departments: Department[];

  @OneToMany(() => Benefit, (benefit) => benefit.tenant)
  benefits: Benefit[];

  @OneToMany(() => EmployeeBenefit, (employeeBenefit) => employeeBenefit.tenant)
  employeeBenefits: EmployeeBenefit[];

  @OneToMany(() => Kpi, (kpi) => kpi.tenant)
  kpis: Kpi[];

  @OneToMany(() => EmployeeKpi, (employeeKpi) => employeeKpi.tenant)
  employeeKpis: EmployeeKpi[];

  @OneToMany(
    () => PerformanceReview,
    (performanceReview) => performanceReview.tenant,
  )
  employeePerformanceReviews: PerformanceReview[];

  @OneToMany(() => Promotion, (promotion) => promotion.tenant)
  employeePromotions: Promotion[];

  @OneToMany(() => Asset, (asset) => asset.tenant)
  assets: Asset[];

  @OneToMany(() => Leave, (leave) => leave.tenant)
  leaves: Leave[];
}
