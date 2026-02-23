/**
 * DB-backed validation for JWT auth (user exists, tenant, permissions).
 * Used by Passport JwtStrategy.validate(); not for request extraction/verify (Passport does that).
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { AUTH_MESSAGES, GLOBAL_SYSTEM_TENANT_ID, UserRole } from '../constants';
import type { ValidatedUser } from '../../modules/auth/interfaces';

@Injectable()
export class TokenValidationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  private isSystemAdminRole(roleName?: string | null): boolean {
    if (!roleName) return false;
    const normalized = roleName.trim().toLowerCase() as UserRole;
    return normalized === UserRole.SYSTEM_ADMIN;
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });
      if (!user || !user.role) return [];
      const permissions = await this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.role', 'role')
        .leftJoin('role.rolePermissions', 'rp')
        .leftJoin('rp.permission', 'permission')
        .where('user.id = :userId', { userId: user.id })
        .select('permission.name', 'name')
        .getRawMany();
      return permissions
        .map((row: { name: string }) => row.name)
        .filter((name) => !!name)
        .map((name) => name.toLowerCase());
    } catch {
      return [];
    }
  }

  async validateUser(userId: string): Promise<ValidatedUser> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });
      if (!user) throw new UnauthorizedException(AUTH_MESSAGES.USER_NOT_FOUND_OR_DELETED);
      if (!user.role?.name) throw new UnauthorizedException(AUTH_MESSAGES.USER_ROLE_NOT_FOUND);
      const isSystemAdmin = this.isSystemAdminRole(user.role.name);
      const tenantId = isSystemAdmin ? GLOBAL_SYSTEM_TENANT_ID : user.tenant_id;
      if (!isSystemAdmin && tenantId) {
        const tenant = await this.tenantRepository.findOne({
          where: { id: tenantId },
        });
        if (!tenant || tenant.deleted_at) {
          throw new UnauthorizedException(AUTH_MESSAGES.ORG_ACCOUNT_DELETED);
        }
      }
      const permissions = await this.getUserPermissions(user.id);
      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role.name.toLowerCase(),
          tenant_id: tenantId,
          permissions,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(AUTH_MESSAGES.TOKEN_VALIDATION_FAILED);
    }
  }
}
