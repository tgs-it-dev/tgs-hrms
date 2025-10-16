import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";

import { EmployeeBenefit } from "./employee-benefit.entity";
import { User } from './user.entity';
import { Designation } from './designation.entity';
import { Team } from './team.entity';
import { EmployeeStatus, InviteStatus } from '../common/constants/enums';

@Entity("employees")
export class Employee {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  user_id: string;

  @Column({ type: "uuid" })
  designation_id: string;

  @Column({ type: 'varchar', length: 20, default: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  @Column({ type: 'varchar', length: 20, nullable:false, default: InviteStatus.INVITE_SENT })
  invite_status: InviteStatus;

  @Column({ type: 'uuid', nullable: true })
  team_id: string | null;

  @CreateDateColumn()
  created_at: Date;
  
  @ManyToOne(() => User, (user) => user.employees, { nullable: false })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Designation, (designation) => designation.employees, {
    nullable: false,
  })
  @JoinColumn({ name: "designation_id" })
  designation: Designation;

  @ManyToOne(() => Team, (team) => team.teamMembers, { nullable: true })
  @JoinColumn({ name: "team_id" })
  team: Team;

  @OneToMany(
    () => EmployeeBenefit,
    (employeeBenefit) => employeeBenefit.employee,
  )
  employeeBenefits: EmployeeBenefit[];
}
