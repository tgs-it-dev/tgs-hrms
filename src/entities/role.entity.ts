import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { User } from './user.entity';
import { RolePermission } from './role-permission.entity';
import { BadRequestException } from '@nestjs/common';

@Entity('roles')
export class Role {
  
  static readonly ALLOWED_ROLES = ['system-admin', 'admin', 'employee'];

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @OneToMany(() => User, (user) => user.role)
  users: User[];

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions: RolePermission[];

  
  @BeforeInsert()
  @BeforeUpdate()
  validateRoleName() {
    if (!Role.ALLOWED_ROLES.includes(this.name)) {
      throw new BadRequestException(
        `Invalid role name: ${this.name}. Allowed roles are: ${Role.ALLOWED_ROLES.join(', ')}`
      );
    }
  }
}
