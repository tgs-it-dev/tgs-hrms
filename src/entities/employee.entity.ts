import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";

import { User } from "./user.entity";
import { Designation } from "./designation.entity";
import { Team } from "./team.entity";
import { EmployeeStatus, InviteStatus } from "../common/constants/enums";

@Index(["user_id"])
@Index(["designation_id"])
@Index(["team_id"])
@Index(["cnic_number"], { unique: true })
@Entity("employees")
export class Employee {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  user_id: string;

  @Column({ type: "uuid" })
  designation_id: string;

  @Column({ type: "varchar", length: 20, default: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  @Column({
    type: "varchar",
    length: 20,
    nullable: false,
    default: InviteStatus.INVITE_SENT,
  })
  invite_status: InviteStatus;

  @Column({ type: "uuid", nullable: true })
  team_id: string | null;

  @Column({ type: "varchar", length: 15, nullable: true })
  cnic_number: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  cnic_picture: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  cnic_back_picture: string | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: "timestamptz", nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => User, (user) => user.employees, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Designation, (designation) => designation.employees, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "designation_id" })
  designation: Designation;

  @ManyToOne(() => Team, (team) => team.teamMembers, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "team_id" })
  team: Team;
}
