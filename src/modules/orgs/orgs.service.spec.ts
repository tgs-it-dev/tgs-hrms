import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  GoneException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { OrgsService } from './orgs.service';
import { OrgMember } from '../../entities/org-member.entity';
import { OrgInvite } from '../../entities/org-invite.entity';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import {
  OrgMemberRole,
  GLOBAL_SYSTEM_TENANT_ID,
} from '../../common/constants/enums';
import { EmailService } from '../../common/utils/email/email.service';
import { SysDbService } from '../../common/services/sys-db.service';

// ─── Fixed UUIDs ──────────────────────────────────────────────────────────────
const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OTHER_ORG_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const VALID_TOKEN = 'a'.repeat(64);
const INVITEE_EMAIL = 'jane@example.com';

// ─── Factory helpers ──────────────────────────────────────────────────────────
const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    tenant_id: ORG_ID,
    email: INVITEE_EMAIL,
    ...overrides,
  }) as unknown as User;

const makeMember = (): OrgMember =>
  ({
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    org_id: OTHER_ORG_ID,
    user_id: USER_ID,
    member_role: OrgMemberRole.MEMBER,
  }) as OrgMember;

const makeInvite = (overrides: Partial<OrgInvite> = {}): OrgInvite =>
  ({
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    org_id: ORG_ID,
    email: INVITEE_EMAIL,
    role: OrgMemberRole.MEMBER,
    token: VALID_TOKEN,
    expires_at: new Date(Date.now() + 60 * 60 * 1_000), // 1 h from now
    used_at: null,
    org: { id: ORG_ID, name: 'Acme Corp' } as unknown as Tenant,
    ...overrides,
  }) as OrgInvite;

// ─── Mock query builders ──────────────────────────────────────────────────────
const mockUserQb = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
} as unknown as SelectQueryBuilder<User>;

const mockOrgMemberQb = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 1 }),
  getOne: jest.fn(),
  getMany: jest.fn(),
} as unknown as SelectQueryBuilder<OrgMember>;

const mockInviteQb = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 1 }),
  getOne: jest.fn(),
} as unknown as SelectQueryBuilder<OrgInvite>;

const mockTenantQb = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
} as unknown as SelectQueryBuilder<Tenant>;

// ─── Mock repositories ────────────────────────────────────────────────────────
const mockUserRepository = {
  createQueryBuilder: jest.fn().mockReturnValue(mockUserQb),
};

const mockOrgMemberRepository = {
  createQueryBuilder: jest.fn().mockReturnValue(mockOrgMemberQb),
  create: jest.fn(),
  save: jest.fn(),
};

const mockOrgInviteRepository = {
  createQueryBuilder: jest.fn().mockReturnValue(mockInviteQb),
  create: jest.fn(),
  save: jest.fn(),
};

const mockTenantRepository = {
  createQueryBuilder: jest.fn().mockReturnValue(mockTenantQb),
};

const mockEmailService = {
  sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
};

const mockSysDbService = {
  sysQuery: jest.fn().mockResolvedValue([{ member_count: '0' }]),
};

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('OrgsService', () => {
  let service: OrgsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository.createQueryBuilder.mockReturnValue(mockUserQb);
    mockOrgMemberRepository.createQueryBuilder.mockReturnValue(mockOrgMemberQb);
    mockOrgInviteRepository.createQueryBuilder.mockReturnValue(mockInviteQb);
    mockTenantRepository.createQueryBuilder.mockReturnValue(mockTenantQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgsService,
        {
          provide: getRepositoryToken(OrgMember),
          useValue: mockOrgMemberRepository,
        },
        {
          provide: getRepositoryToken(OrgInvite),
          useValue: mockOrgInviteRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: EmailService, useValue: mockEmailService },
        { provide: SysDbService, useValue: mockSysDbService },
      ],
    }).compile();

    service = module.get<OrgsService>(OrgsService);
  });

  // ─── validateOrgAccess ──────────────────────────────────────────────────────
  describe('validateOrgAccess', () => {
    it('allows access when user primary tenant matches orgId', async () => {
      (mockUserQb.getOne as jest.Mock).mockResolvedValue(
        makeUser({ tenant_id: ORG_ID }),
      );

      await expect(
        service.validateOrgAccess(USER_ID, ORG_ID),
      ).resolves.toBeUndefined();
    });

    it('allows access for system-admin users (GLOBAL_SYSTEM_TENANT_ID)', async () => {
      (mockUserQb.getOne as jest.Mock).mockResolvedValue(
        makeUser({ tenant_id: GLOBAL_SYSTEM_TENANT_ID }),
      );

      await expect(
        service.validateOrgAccess(USER_ID, ORG_ID),
      ).resolves.toBeUndefined();
    });

    it('allows access when an explicit org_members row exists (cross-org member)', async () => {
      (mockUserQb.getOne as jest.Mock).mockResolvedValue(
        makeUser({ tenant_id: OTHER_ORG_ID }),
      );
      (mockOrgMemberQb.getOne as jest.Mock).mockResolvedValue(makeMember());

      await expect(
        service.validateOrgAccess(USER_ID, ORG_ID),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException (403) when user has no access to the org', async () => {
      (mockUserQb.getOne as jest.Mock).mockResolvedValue(
        makeUser({ tenant_id: OTHER_ORG_ID }),
      );
      (mockOrgMemberQb.getOne as jest.Mock).mockResolvedValue(null);

      await expect(service.validateOrgAccess(USER_ID, ORG_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException (403) when user is not found', async () => {
      (mockUserQb.getOne as jest.Mock).mockResolvedValue(null);

      await expect(service.validateOrgAccess(USER_ID, ORG_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── getMembership ──────────────────────────────────────────────────────────
  describe('getMembership', () => {
    it('returns membership row when it exists', async () => {
      const member = makeMember();
      (mockOrgMemberQb.getOne as jest.Mock).mockResolvedValue(member);

      const result = await service.getMembership(USER_ID, OTHER_ORG_ID);
      expect(result).toBe(member);
    });

    it('returns null when no membership exists', async () => {
      (mockOrgMemberQb.getOne as jest.Mock).mockResolvedValue(null);

      const result = await service.getMembership(USER_ID, OTHER_ORG_ID);
      expect(result).toBeNull();
    });
  });

  // ─── acceptInvite ───────────────────────────────────────────────────────────
  describe('acceptInvite', () => {
    it('returns 404 when token is not found', async () => {
      (mockInviteQb.getOne as jest.Mock).mockResolvedValue(null);

      await expect(service.acceptInvite(VALID_TOKEN, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 410 Gone when the invite has already been used', async () => {
      (mockInviteQb.getOne as jest.Mock).mockResolvedValue(
        makeInvite({ used_at: new Date('2024-01-01') }),
      );

      await expect(service.acceptInvite(VALID_TOKEN, USER_ID)).rejects.toThrow(
        GoneException,
      );
    });

    it('returns 400 with a user-friendly message when the invite has expired', async () => {
      (mockInviteQb.getOne as jest.Mock).mockResolvedValue(
        makeInvite({ expires_at: new Date('2020-01-01'), used_at: null }),
      );

      const err = await service
        .acceptInvite(VALID_TOKEN, USER_ID)
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toMatch(/expired/i);
    });

    it('returns 403 when the requesting user email does not match the invite', async () => {
      (mockInviteQb.getOne as jest.Mock).mockResolvedValue(makeInvite());
      (mockUserQb.getOne as jest.Mock).mockResolvedValue(
        makeUser({ email: 'other@example.com' }),
      );

      await expect(service.acceptInvite(VALID_TOKEN, USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('auto-joins existing user to org without re-registration (criterion 3)', async () => {
      (mockInviteQb.getOne as jest.Mock).mockResolvedValue(makeInvite());
      (mockUserQb.getOne as jest.Mock).mockResolvedValue(
        makeUser({ email: INVITEE_EMAIL }),
      );
      // No existing membership
      (mockOrgMemberQb.getOne as jest.Mock).mockResolvedValue(null);
      const newMember = makeMember();
      mockOrgMemberRepository.create.mockReturnValue(newMember);
      mockOrgMemberRepository.save.mockResolvedValue(newMember);

      const result = await service.acceptInvite(VALID_TOKEN, USER_ID);

      expect(result.orgId).toBe(ORG_ID);
      expect(result.role).toBe(OrgMemberRole.MEMBER);
      expect(result.message).toMatch(/successfully added/i);
      // used_at must be written
      expect(mockInviteQb.execute).toHaveBeenCalled();
    });

    it('returns 409 Conflict when user is already a member', async () => {
      (mockInviteQb.getOne as jest.Mock).mockResolvedValue(makeInvite());
      (mockUserQb.getOne as jest.Mock).mockResolvedValue(
        makeUser({ email: INVITEE_EMAIL }),
      );
      (mockOrgMemberQb.getOne as jest.Mock).mockResolvedValue(makeMember());

      await expect(service.acceptInvite(VALID_TOKEN, USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
