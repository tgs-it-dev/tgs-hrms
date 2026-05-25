import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "../../entities/role.entity";
import { Tenant } from "../../entities/tenant.entity";
import { Employee } from "../../entities/employee.entity";
import { CompanyDetails } from "../../entities/company-details.entity";
import { SignupSession } from "../../entities/signup-session.entity";
import { UserToken } from "../../entities/user-token.entity";
import { EmailService } from "../../common/utils/email";
import { InviteStatusService } from "../invite-status/invite-status.service";
import { TenantSettingsService } from "../tenant-settings/tenant-settings.service";
import { IpWhitelistService } from "../ip-whitelist/ip-whitelist.service";

const mockPassword = bcrypt.hashSync("123456", 10);

const mockRole: Role = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "admin",
  description: "Administrator role",
  users: [],
  rolePermissions: [],
};

const mockTenant: Tenant = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Test Company",
  status: "active",
  schema_provisioned: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  users: [],
  departments: [],
  designations: [],
  leaves: [],
  geofences: [],
};

const mockUser: User = {
  id: "1",
  email: "admin@company.com",
  password: mockPassword,
  role_id: "11111111-1111-1111-1111-111111111111",
  tenant_id: "11111111-1111-1111-1111-111111111111",
  reset_token: "",
  reset_token_expiry: null,
  first_name: "Admin",
  last_name: "User",
  phone: "1234567890",
  gender: null,
  profile_pic: null,
  first_login_time: new Date(0),
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  role: mockRole,
  tenant: mockTenant,
  employees: [],
  attendances: [],
  managedTeams: [],
};

const mockUserRepository = () => ({
  find: jest.fn().mockResolvedValue([mockUser]),
  findOneBy: jest.fn().mockResolvedValue(mockUser),
  save: jest.fn(),
  create: jest.fn(),
  findOne: jest
    .fn()
    .mockImplementation(
      ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email === mockUser.email) return Promise.resolve(mockUser);
        if (where.id) return Promise.resolve(mockUser);
        return Promise.resolve(null);
      },
    ),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  query: jest.fn().mockResolvedValue([]),
  createQueryBuilder: jest.fn(() => ({
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(mockUser),
  })),
});

const mockJwtService = {
  sign: jest.fn().mockReturnValue("mocked-jwt-token"),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === "JWT_SECRET") return "mocked-secret";
    if (key === "JWT_EXPIRES_IN") return "24h";
    return null;
  }),
};

const mockEmailService = {
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetSuccessEmail: jest.fn().mockResolvedValue(undefined),
};

describe("AuthService - Login", () => {
  let service: AuthService;
  let userRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        {
          provide: getRepositoryToken(Employee),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(CompanyDetails),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(SignupSession),
          useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
        { provide: getRepositoryToken(Role), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              ...mockTenant,
              status: "active",
              deleted_at: null,
            }),
          },
        },
        {
          provide: getRepositoryToken(UserToken),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn().mockResolvedValue({}),
            create: jest.fn(),
            delete: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailService, useValue: mockEmailService },
        {
          provide: InviteStatusService,
          useValue: { getInviteStatus: jest.fn(), setInviteStatus: jest.fn() },
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
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it("should validate and return access token for valid credentials", async () => {
    jest
      .spyOn(bcrypt, "compare")
      .mockImplementation(() => Promise.resolve(true));

    const result = await service.validateUser("admin@company.com", "123456");

    expect(result).toHaveProperty("accessToken", "mocked-jwt-token");
    expect(result.user?.email).toBe("admin@company.com");
  });

  it("should throw error for invalid email", async () => {
    jest.spyOn(userRepo, "find").mockResolvedValue([]);
    await expect(
      service.validateUser("wrong@company.com", "123456"),
    ).rejects.toThrow(BadRequestException);
  });

  it("should throw error for invalid password", async () => {
    jest
      .spyOn(bcrypt, "compare")
      .mockImplementation(() => Promise.resolve(false));

    await expect(
      service.validateUser("admin@company.com", "wrongpass"),
    ).rejects.toThrow(BadRequestException);
  });
});
