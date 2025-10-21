import { Benefit } from "./benefit.entity";
import { EmployeeBenefit } from "./employee-benefit.entity";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Department } from './department.entity';
import { Kpi } from "./kpi.entity";
import { EmployeeKpi } from "./employee-kpi.entity";
import { PerformanceReview } from "./performance-review.entity";
import { Promotion } from "./promotion.entity";
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

  @OneToMany(() => Kpi, (kpi) => kpi.tenant)
  kpis: Kpi[];
  
  @OneToMany(() => EmployeeKpi, (employeeKpi) => employeeKpi.tenant)
  employeeKpis: EmployeeKpi[];
  
  @OneToMany(
  () => PerformanceReview,
  (performanceReview) => performanceReview.employee,
  )
  employeePerformanceReviews: PerformanceReview[];
  
  @OneToMany(() => Promotion, (promotion) => promotion.employee)
  employeePromotions: Promotion[];


}

