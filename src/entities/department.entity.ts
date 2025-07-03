import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
@Entity()
@Index(['tenantId', 'name'], { unique: true }) 
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;


  @Column({ type: 'uuid' })
  tenantId: string; 

  @ManyToOne(() => Company, (company) => company.departments, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'tenant' }) 
  tenant: Company;
 

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
