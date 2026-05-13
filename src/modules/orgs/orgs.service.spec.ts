import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { OrgsService } from './orgs.service';
import { OrgMember } from '../../entities/org-member.entity';
import { User } from '../../entities/user.entity';
import {
  OrgMemberRole,
  GLOBAL_SYSTEM_TENANT_ID,
} from '../../common/constants/enums';

const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OTHER_ORG_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({ id: USER_ID, tenant_id: ORG_ID, ...overrides }) as unknown as User;

const makeMember = (): OrgMember =>
  ({
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    org_id: OTHER_ORG_ID,
    user_id: USER_ID,
    member_role: OrgMemberRole.MEMBER,
  }) as OrgMember;

describe('OrgsService', () => {
  let service: OrgsService;

  const mockUserQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  } as unknown as SelectQueryBuilder<User>;

  const mockOrgMemberQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  } as unknown as SelectQueryBuilder<OrgMember>;

  const mockUserRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockUserQb),
  };

  const mockOrgMemberRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockOrgMemberQb),
    create: jest.fn(),
    save: jest.fn(),
    leftJoinAndSelect: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository.createQueryBuilder.mockReturnValue(mockUserQb);
    mockOrgMemberRepository.createQueryBuilder.mockReturnValue(mockOrgMemberQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgsService,
        {
          provide: getRepositoryToken(OrgMember),
          useValue: mockOrgMemberRepository,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<OrgsService>(OrgsService);
  });

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
      // User belongs to a different primary tenant
      (mockUserQb.getOne as jest.Mock).mockResolvedValue(
        makeUser({ tenant_id: OTHER_ORG_ID }),
      );
      // But has an explicit membership in the requested org
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
});
