import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  GoneException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { OrgMember } from '../../entities/org-member.entity';
import { OrgInvite } from '../../entities/org-invite.entity';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { OrgMemberRole } from '../../common/constants/enums';
import { GLOBAL_SYSTEM_TENANT_ID } from '../../common/constants/enums';
import { EmailService } from '../../common/utils/email/email.service';
import { SysDbService } from '../../common/services/sys-db.service';
import { CreateInviteDto } from './dto/create-invite.dto';

/** How long (ms) an invite token remains valid. */
const INVITE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

@Injectable()
export class OrgsService {
  private readonly logger = new Logger(OrgsService.name);

  constructor(
    @InjectRepository(OrgMember)
    private readonly orgMemberRepository: Repository<OrgMember>,
    @InjectRepository(OrgInvite)
    private readonly orgInviteRepository: Repository<OrgInvite>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly sysDb: SysDbService,
  ) {}

  // ─── Org-access guard ──────────────────────────────────────────────────────

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

  // ─── Membership helpers ────────────────────────────────────────────────────

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

  // ─── Invite lifecycle ──────────────────────────────────────────────────────

  /**
   * Creates a one-time invite link for `dto.email` to join `orgId`.
   *
   * - Generates a 32-byte cryptographically-random hex token.
   * - Persists the invite record (expires in 24 h).
   * - Fires an invitation email via the BullMQ email queue (non-blocking).
   */
  async createInvite(
    orgId: string,
    dto: CreateInviteDto,
    invitedBy: string,
  ): Promise<{ inviteId: string; expiresAt: Date }> {
    const org = await this.tenantRepository
      .createQueryBuilder('t')
      .select(['t.id', 't.name', 't.seat_limit'])
      .where('t.id = :orgId', { orgId })
      .getOne();

    if (!org) {
      throw new NotFoundException('Organisation not found.');
    }

    await this.enforceSeatLimit(orgId, org);

    const inviteeEmail = dto.email.toLowerCase();

    // Check if invitee is already a member via their primary tenant
    const existingUser = await this.userRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.tenant_id'])
      .where('LOWER(u.email) = :email', { email: inviteeEmail })
      .getOne();

    if (existingUser) {
      if (existingUser.tenant_id === orgId) {
        throw new ConflictException(
          'This user is already a member of the organisation.',
        );
      }
      const existingMembership = await this.getMembership(
        existingUser.id,
        orgId,
      );
      if (existingMembership) {
        throw new ConflictException(
          'This user is already a member of the organisation.',
        );
      }
    }

    // Token: 32 random bytes → 64 hex chars, URL-safe
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const invite = this.orgInviteRepository.create({
      org_id: orgId,
      email: inviteeEmail,
      role: dto.role,
      token,
      expires_at: expiresAt,
      used_at: null,
      invited_by: invitedBy,
    });

    const saved = await this.orgInviteRepository.save(invite);

    // Fire-and-forget — email failure must never block the API response
    this.emailService
      .sendInvitationEmail(inviteeEmail, inviteeEmail, org.name, token)
      .catch((err: unknown) => {
        this.logger.error(
          `Failed to send invite email to ${inviteeEmail}: ${(err as Error).message}`,
        );
      });

    return { inviteId: saved.id, expiresAt };
  }

  // ─── Seat-limit enforcement ────────────────────────────────────────────────

  /**
   * Throws 402 when the org has reached its plan seat cap.
   * No-op when seat_limit is null (unlimited plan).
   */
  private async enforceSeatLimit(
    orgId: string,
    org: Pick<Tenant, 'id' | 'name' | 'seat_limit'>,
  ): Promise<void> {
    if (org.seat_limit === null || org.seat_limit === undefined) return;

    const rows = await this.sysDb.sysQuery<{ member_count: string }>(
      `SELECT COUNT(*) AS member_count FROM org_members WHERE org_id = $1`,
      [orgId],
    );

    const currentCount = parseInt(rows[0]?.member_count ?? '0', 10);
    if (currentCount >= org.seat_limit) {
      throw new HttpException(
        {
          code: 'SEAT_LIMIT_REACHED',
          message: `Your plan allows a maximum of ${org.seat_limit} members. Upgrade to invite more.`,
          upgradeUrl: '/settings/billing',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /**
   * Returns public metadata about an invite so the frontend can render
   * the accept page without requiring authentication.
   *
   * Intentionally does NOT reveal used/expired status to unauthenticated
   * callers — that information is only surfaced on the accept attempt.
   */
  async getInviteInfo(token: string): Promise<{
    orgName: string;
    email: string;
    role: OrgMemberRole;
    expiresAt: Date;
  }> {
    const invite = await this.orgInviteRepository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.org', 'org')
      .where('i.token = :token', { token })
      .getOne();

    if (!invite) {
      throw new NotFoundException('Invite not found.');
    }

    return {
      orgName: invite.org.name,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expires_at,
    };
  }

  /**
   * Accepts an invite on behalf of an authenticated user.
   *
   * Validation order (matches the acceptance criteria):
   *   1. Token not found          → 404 Not Found
   *   2. `used_at` is set         → 410 Gone  ("already used")
   *   3. `expires_at` in the past → 400 Bad Request ("expired — user-friendly")
   *   4. Requesting user's email ≠ invite email → 403 Forbidden
   *   5. User already a member    → 409 Conflict (idempotent guard)
   *   6. Happy path               → create org_members row, set used_at
   */
  async acceptInvite(
    token: string,
    userId: string,
  ): Promise<{ message: string; orgId: string; role: OrgMemberRole }> {
    const invite = await this.orgInviteRepository
      .createQueryBuilder('i')
      .where('i.token = :token', { token })
      .getOne();

    if (!invite) {
      throw new NotFoundException('Invite not found.');
    }

    // Criterion 1: one-time use — 410 Gone on second attempt
    if (invite.used_at !== null) {
      throw new GoneException(
        'This invite link has already been used. Please request a new invitation.',
      );
    }

    // Criterion 2: expired token — user-friendly 400
    if (invite.expires_at < new Date()) {
      const expiredAt = invite.expires_at.toUTCString();
      throw new BadRequestException(
        `This invite link expired on ${expiredAt}. Please ask an admin to send a new invitation.`,
      );
    }

    // Verify the requesting user owns the invited email address
    const user = await this.userRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.tenant_id'])
      .where('u.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new ForbiddenException('Access denied.');
    }

    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException(
        'This invite was sent to a different email address.',
      );
    }

    // Criterion 3: existing user auto-joined without re-registration
    // Guard: skip insert if already a member (idempotent)
    const existingMembership = await this.getMembership(userId, invite.org_id);
    if (existingMembership) {
      // Still mark the invite consumed so it cannot be replayed
      await this.orgInviteRepository
        .createQueryBuilder()
        .update(OrgInvite)
        .set({ used_at: new Date() })
        .where('id = :id', { id: invite.id })
        .execute();

      throw new ConflictException(
        'You are already a member of this organisation.',
      );
    }

    // Add to org_members
    await this.addMember(invite.org_id, userId, invite.role);

    // Mark invite consumed (one-time enforcement)
    await this.orgInviteRepository
      .createQueryBuilder()
      .update(OrgInvite)
      .set({ used_at: new Date() })
      .where('id = :id', { id: invite.id })
      .execute();

    this.logger.log(
      `User ${userId} accepted invite ${invite.id} and joined org ${invite.org_id} as ${invite.role}`,
    );

    return {
      message: 'You have been successfully added to the organisation.',
      orgId: invite.org_id,
      role: invite.role,
    };
  }
}
