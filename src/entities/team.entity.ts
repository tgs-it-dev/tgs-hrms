import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Employee } from './employee.entity';

@Index(['manager_id'])
@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid' })
  manager_id: string;

  @CreateDateColumn()
  created_at: Date;

  
  @ManyToOne(() => User, (user) => user.managedTeams, { nullable: false })
  @JoinColumn({ name: 'manager_id' })
  manager: User;

  @OneToMany(() => Employee, (employee) => employee.team)
  teamMembers: Employee[];
}
