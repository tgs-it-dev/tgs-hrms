import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity";
import { Employee } from "../../entities/employee.entity";
import { CompanyDetails } from "../../entities/company-details.entity";
import { SignupSession } from "../../entities/signup-session.entity";
import { UserToken } from "../../entities/user-token.entity";
import { Role } from "../../entities/role.entity";
import { Tenant } from "../../entities/tenant.entity";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../../common/utils/email";
import { InviteStatusService } from "../invite-status/invite-status.service";
import { TenantSettingsService } from "../tenant-settings/tenant-settings.service";
import { IpWhitelistService } from "../ip-whitelist/ip-whitelist.service";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";

describe("AuthService - Refresh Token", () => {
  let service: AuthService;
  let _jwtService: JwtService;
  let userRepository: any;
  let userTokenRepository: any;

  const mockRole = {
    id: "role-id",
    name: "employee",
    description: "",
    users: [],
    rolePermissions: [],
  };
  const mockTenant = {
    id: "tenant-id",
    status: "active",
    deleted_at: null,
    name: "Test Co",
  };
  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    tenant_id: "tenant-id",
    first_login_time: new Date(0),
    role: mockRole,
  };

  // Non-revoked, non-expired token record — the happy-path fixture
  const mockTokenRecord = {
    id: "valid-jti",
    user_id: "user-1",
    is_revoked: false,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    platform: null,
    device_info: null,
    ip_address: null,
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue("new-access-token"),
    verify: jest
      .fn()
      .mockReturnValue({ type: "refresh", jti: "valid-jti", sub: "user-1" }),
    decode: jest.fn().mockReturnValue({ jti: "valid-jti" }),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === "JWT_SECRET") return "mocked-secret";
      if (key === "JWT_REFRESH_SECRET") return "mocked-refresh-secret";
      if (key === "JWT_EXPIRES_IN") return "24h";
      return null;
    }),
  };

  const mockEmailService = {
    sendPasswordResetEmail: jest.fn(),
    sendPasswordResetSuccessEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([mockUser]),
            findOne: jest.fn().mockResolvedValue(mockUser),
            save: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            query: jest.fn().mockResolvedValue([]),
            createQueryBuilder: jest.fn(() => ({
              leftJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
            })),
          },
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(CompanyDetails),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(SignupSession),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Role),
          useValue: { findOne: jest.fn().mockResolvedValue(mockRole) },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: { findOne: jest.fn().mockResolvedValue(mockTenant) },
        },
        {
          provide: getRepositoryToken(UserToken),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockTokenRecord),
            save: jest.fn().mockResolvedValue(mockTokenRecord),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            manager: {
              transaction: jest
                .fn()
                .mockImplementation(async (fn: (em: any) => Promise<any>) => {
                  const mockEm = {
                    update: jest.fn().mockResolvedValue({ affected: 1 }),
                    save: jest.fn().mockResolvedValue({}),
                  };
                  return fn(mockEm);
                }),
            },
          },
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailService, useValue: mockEmailService },
        {
          provide: InviteStatusService,
          useValue: {
            updateInviteStatusOnLogin: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TenantSettingsService,
          useValue: {
            getSettings: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: IpWhitelistService,
          useValue: {
            isAllowed: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    _jwtService = module.get<JwtService>(JwtService);
    userRepository = module.get(getRepositoryToken(User));
    userTokenRepository = module.get(getRepositoryToken(UserToken));
  });

  describe("refreshToken", () => {
    const mockRefreshToken = "valid-refresh-token";

    it("should successfully refresh with valid token and return new access + refresh tokens", async () => {
      // verify returns { type:'refresh', jti:'valid-jti', sub:'user-1' }
      // userTokenRepo.findOne returns non-revoked, non-expired record
      // userRepo.findOne returns user with role
      const result = await service.refreshToken(mockRefreshToken);

      expect(result).toHaveProperty("accessToken", "new-access-token");
      expect(result).toHaveProperty("refreshToken", "new-access-token"); // sign mock always returns same value
      expect(mockJwtService.verify).toHaveBeenCalledWith(mockRefreshToken, {
        secret: "mocked-refresh-secret",
      });
    });

    it("should throw BadRequestException when refresh token is missing", async () => {
      await expect(service.refreshToken("")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw UnauthorizedException when token record is not found", async () => {
      // Token jti doesn't exist in DB
      userTokenRepository.findOne.mockResolvedValue(null);
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when token is revoked", async () => {
      userTokenRepository.findOne.mockResolvedValue({
        ...mockTokenRecord,
        is_revoked: true,
      });
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when user is not found", async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when JWT verification fails", async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
