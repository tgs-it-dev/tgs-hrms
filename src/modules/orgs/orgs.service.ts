import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgMember } from '../../entities/org-member.entity';
import { OrgMemberRole } from '../../common/constants/enums';

@Injectable()
export class OrgsService {
  constructor(
    @InjectRepository(OrgMember)
    private readonly orgMemberRepository: Repository<OrgMember>,
  ) {}

  /**
   * Returns the membership record for a given user + org pair.
   * Returns null when no membership exists.
   *
   * All queries use parameterised placeholders (:userId, :orgId) —
   * no string interpolation anywhere.
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

  /**
   * Returns all members of an org, ordered by role then created date.
   */
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
   * The member_role column is a native PostgreSQL ENUM so the DB will
   * reject any value not in ('owner', 'admin', 'member').
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

  /**
   * Updates the role of an existing member.
   */
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

  /**
   * Removes a user from an org.
   */
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
