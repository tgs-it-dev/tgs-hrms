import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.permission)
  rolePermissions: RolePermission[];
} 