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
import { Leave } from "./leave.entity";
import { Designation } from "./designation.entity";
import { Geofence } from "./geofence.entity";

@Entity("tenants")
export class Tenant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", default: "active" })
  status: "active" | "suspended";

  @Column({ type: "boolean", default: false })
  schema_provisioned: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ type: "timestamptz", nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Department, (department) => department.tenant)
  departments: Department[];

  @OneToMany(() => Designation, (designation) => designation.tenant)
  designations: Designation[];

  @OneToMany(() => Leave, (leave) => leave.tenant)
  leaves: Leave[];

  @OneToMany(() => Geofence, (geofence) => geofence.tenant)
  geofences: Geofence[];
}
