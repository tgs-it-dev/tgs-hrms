import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { Designation } from './designation.entity'; 

@Entity()
@Index(['tenantId', 'name'], { unique: true })
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @ManyToOne(() => Company, (company) => company.departments, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'tenantId' })
  tenant: Company;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  
  @OneToMany(() => Designation, (designation) => designation.department)
  designations: Designation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
