import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  role_id: string;

  @Column({ type: 'uuid', nullable: false })
  permission_id: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, { nullable: false })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, { nullable: false })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
} 