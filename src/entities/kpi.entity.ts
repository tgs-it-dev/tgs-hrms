import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Tenant } from "./tenant.entity";
import { EmployeeKpi } from "./employee-kpi.entity";

@Entity("kpis")
export class Kpi {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "float", comment: "Percentage weight in evaluation" })
  weight: number;

  @Column({ length: 100 })
  category: string;

  @Column()
  tenant_id: string;

  @Column()
  createdBy: string;

  @Column({ default: "active" })
  status: "active" | "inactive";

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.kpis, { nullable: false })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @OneToMany(() => EmployeeKpi, (employeeKpi) => employeeKpi.kpi)
  employeeKpis: EmployeeKpi[];
}
