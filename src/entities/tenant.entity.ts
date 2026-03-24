import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from "typeorm";
import { User } from "./user.entity";
import { Department } from "./department.entity";
import { Kpi } from "./kpi.entity";
import { EmployeeKpi } from "./employee-kpi.entity";
import { PerformanceReview } from "./performance-review.entity";
import { Promotion } from "./promotion.entity";
import { Leave } from "./leave.entity";
import { Designation } from "./designation.entity";
import { Task } from "./task.entity";
import { Geofence } from "./geofence.entity";

@Entity("tenants")
export class Tenant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", default: "active" })
  status: "active" | "suspended";

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ type: "timestamptz", nullable: true })
  deleted_at: Date | null;

  // --- Relations ---
  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Department, (department) => department.tenant)
  departments: Department[];

  @OneToMany(() => Designation, (designation) => designation.tenant)
  designations: Designation[];

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

  @OneToMany(() => Leave, (leave) => leave.tenant)
  leaves: Leave[];

  @OneToMany(() => Task, (task) => task.tenant)
  tasks: Task[];

  @OneToMany(() => Geofence, (geofence) => geofence.tenant)
  geofences: Geofence[];
}
