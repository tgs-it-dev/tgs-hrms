import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { EmployeeBenefit } from './employee-benefit.entity';
import { Employee } from './employee.entity';
import { Tenant } from './tenant.entity';
import { BenefitReimbursementStatus } from '../common/constants/enums';

@Entity('benefit_reimbursement_requests')
export class BenefitReimbursementRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @Index()
  @Column({ type: 'uuid', name: 'employee_benefit_id' })
  employeeBenefitId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  details: string;

  @Column({ type: 'text', array: true, nullable: true, default: [], name: 'proof_documents' })
  proofDocuments: string[];

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: BenefitReimbursementStatus.PENDING,
  })
  status: BenefitReimbursementStatus;

  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by' })
  reviewedBy: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: Employee | null;

  @Column({ type: 'timestamp', nullable: true, name: 'reviewed_at' })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'review_remarks' })
  reviewRemarks: string | null;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Employee, (employee) => employee.id, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => EmployeeBenefit, (eb) => eb.id, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_benefit_id' })
  employeeBenefit: EmployeeBenefit;

  @ManyToOne(() => Tenant, (tenant) => tenant.id, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
