import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Designation } from './designation.entity';
import { Team } from './team.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  designation_id: string;

  @Column({ type: 'uuid', nullable: true })
  team_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (user) => user.employees, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Designation, (designation) => designation.employees, { nullable: false })
  @JoinColumn({ name: 'designation_id' })
  designation: Designation;

  @ManyToOne(() => Team, (team) => team.teamMembers, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team;
}
