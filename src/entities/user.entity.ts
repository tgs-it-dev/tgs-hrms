import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column()
  tenantId: number;

  @Column()
  role: 'admin' | 'staff';

  @Column({ nullable: true })
resetToken: string;

@Column({ nullable: true })
resetTokenExpiry: Date;

}
