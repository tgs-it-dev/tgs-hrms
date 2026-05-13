import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgMember } from '../../entities/org-member.entity';
import { User } from '../../entities/user.entity';
import { OrgMemberRole } from '../../common/constants/enums';
import { GLOBAL_SYSTEM_TENANT_ID } from '../../common/constants/enums';

@Injectable()
export class OrgsService {
  constructor(
    @InjectRepository(OrgMember)
    private readonly orgMemberRepository: Repository<OrgMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Asserts that `userId` is allowed to access `orgId`.
   *
   * Two paths grant access:
   *   1. The user's primary tenant_id matches the requested org (the normal
   *      case — every user belongs to exactly one tenant/org).
   *   2. An explicit org_members row exists for the pair (future cross-org
   *      invited members).
   *
   * System-admin users (tenant_id = GLOBAL_SYSTEM_TENANT_ID) bypass the
   * check because they administer the whole platform.
   *
   * Throws ForbiddenException (HTTP 403) when neither path grants access.
   * All queries are parameterised — no string interpolation.
   */
  async validateOrgAccess(userId: string, orgId: string): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.tenant_id'])
      .where('u.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new ForbiddenException('Access denied.');
    }

    // System-admins manage the whole platform — exempt from tenant scoping
    if (user.tenant_id === GLOBAL_SYSTEM_TENANT_ID) {
      return;
    }

    // Primary check: user's own tenant matches the requested org
    if (user.tenant_id === orgId) {
      return;
    }

    // Secondary check: explicit membership row (cross-org invited users)
    const membership = await this.getMembership(userId, orgId);
    if (membership) {
      return;
    }

    throw new ForbiddenException(
      'You do not have access to this organisation.',
    );
  }

  /**
   * Returns the membership record for a given user + org pair,
   * or null when no explicit membership exists.
   */
  async getMembership(
    userId: string,
    orgId: string,
  ): Promise<OrgMember | null> {
    return this.orgMemberRepository
      .createQueryBuilder('om')
      .where('om.user_id = :userId', { userId })
      .andWhere('om.org_id = :orgId', { orgId })
      .getOne();
  }

  /** Returns all members of an org ordered by role then join date. */
  async listMembers(orgId: string): Promise<OrgMember[]> {
    return this.orgMemberRepository
      .createQueryBuilder('om')
      .leftJoinAndSelect('om.user', 'user')
      .where('om.org_id = :orgId', { orgId })
      .orderBy('om.member_role', 'ASC')
      .addOrderBy('om.created_at', 'ASC')
      .getMany();
  }

  /**
   * Adds a user to an org with the given role.
   * member_role is a native PostgreSQL ENUM — the DB rejects invalid values.
   */
  async addMember(
    orgId: string,
    userId: string,
    role: OrgMemberRole,
  ): Promise<OrgMember> {
    const member = this.orgMemberRepository.create({
      org_id: orgId,
      user_id: userId,
      member_role: role,
    });
    return this.orgMemberRepository.save(member);
  }

  /** Updates the role of an existing member. */
  async updateRole(
    orgId: string,
    userId: string,
    role: OrgMemberRole,
  ): Promise<void> {
    await this.orgMemberRepository
      .createQueryBuilder()
      .update(OrgMember)
      .set({ member_role: role })
      .where('org_id = :orgId', { orgId })
      .andWhere('user_id = :userId', { userId })
      .execute();
  }

  /** Removes a user from an org. */
  async removeMember(orgId: string, userId: string): Promise<void> {
    await this.orgMemberRepository
      .createQueryBuilder()
      .delete()
      .from(OrgMember)
      .where('org_id = :orgId', { orgId })
      .andWhere('user_id = :userId', { userId })
      .execute();
  }
}
