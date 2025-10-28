import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("system_logs")
@Index(["tenantId", "createdAt"])
@Index(["userId", "action"])
export class SystemLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  action: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  entityType: string | null;

  @Column({ type: "uuid", nullable: true })
  @Index()
  userId: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  userRole: string | null;

  @Column({ type: "uuid", nullable: true })
  @Index()
  tenantId: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  route: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  method: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  ip: string | null;

  @Column({ type: "jsonb", nullable: true })
  meta: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
