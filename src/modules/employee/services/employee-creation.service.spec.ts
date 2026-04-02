import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmployeeCreationService } from './employee-creation.service';
import { EmployeeValidationService } from './employee-validation.service';
import { EmployeeNotificationService } from './employee-notification.service';
import { EmployeeFileService } from './employee-file.service';
import { Employee } from '../../../entities/employee.entity';
import { User } from '../../../entities/user.entity';
import { Designation } from '../../../entities/designation.entity';
import { Role } from '../../../entities/role.entity';
import { Team } from '../../../entities/team.entity';
import { CreateEmployeeDto } from '../dto/employee.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService, EmailTemplateService } from '../../../common/utils/email';
import { BillingService } from '../../billing/services/billing.service';
import { EmployeeSalaryService } from '../../payroll/services/employee-salary.service';

const tenantId = '93ada9b3-fef5-4af3-ba65-035c833ea390';
const actorUserId = '10000000-0000-0000-0000-000000000001';

const createDto: CreateEmployeeDto = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '123456',
  designation_id: 'desig-uuid',
};

const mockEmployeeRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  manager: {
    transaction: jest.fn(),
  },
};

const mockDesignationRepo = { findOne: jest.fn(), findOneBy: jest.fn() };
const mockRoleRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockTeamRepo = { findOne: jest.fn() };

const mockEmailService = { getFromEmail: jest.fn(), send: jest.fn() };
const mockEmailTemplateService = { render: jest.fn() };
const mockBillingService = {
  handleEmployeeCreated: jest.fn().mockResolvedValue(undefined),
  createEmployeePaymentCheckout: jest.fn(),
};
const mockEmployeeSalaryService = {
  getSalaryTemplateForTenant: jest.fn().mockResolvedValue({
    baseSalary: 0,
    allowances: [],
    deductions: [],
  }),
  create: jest.fn().mockResolvedValue(undefined),
};
const mockEventEmitter = { emit: jest.fn() };
const mockFileService = {
  uploadProfilePicture: jest.fn(),
  uploadCnicPicture: jest.fn(),
  uploadCnicBackPicture: jest.fn(),
};

const customRoleId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
const nonExistentRoleId = 'b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e';

type TransactionManager = {
  getRepository: (e: unknown) => typeof mockUserRepo | typeof mockEmployeeRepo;
};

describe('EmployeeCreationService', () => {
  let service: EmployeeCreationService;

  beforeEach(async () => {
    mockUserRepo.manager.transaction.mockImplementation(async (fn: (m: TransactionManager) => Promise<Employee>) => {
      const manager: TransactionManager = {
        getRepository: (entity: unknown) => {
          if (entity === User) return mockUserRepo;
          if (entity === Employee) return mockEmployeeRepo;
          return mockEmployeeRepo;
        },
      };
      return fn(manager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeCreationService,
        EmployeeValidationService,
        {
          provide: EmployeeNotificationService,
          useValue: {
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            sendNewEmployeeAnnouncementToTenant: jest.fn().mockResolvedValue(undefined),
            errorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
          },
        },
        { provide: EmployeeFileService, useValue: mockFileService },
        { provide: getRepositoryToken(Employee), useValue: mockEmployeeRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Designation), useValue: mockDesignationRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(Team), useValue: mockTeamRepo },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EmailService, useValue: mockEmailService },
        { provide: EmailTemplateService, useValue: mockEmailTemplateService },
        { provide: BillingService, useValue: mockBillingService },
        { provide: EmployeeSalaryService, useValue: mockEmployeeSalaryService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<EmployeeCreationService>(EmployeeCreationService);

    mockRoleRepo.findOne.mockResolvedValue({ id: 'role-uuid', name: 'Employee' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw conflict if email exists in same tenant', async () => {
    mockDesignationRepo.findOne.mockResolvedValue({
      id: 'desig-uuid',
      department: { tenant_id: tenantId },
    });
    mockUserRepo.findOne.mockResolvedValue({
      id: 'existing-user',
      email: createDto.email,
      tenant_id: tenantId,
    });

    await expect(service.create(tenantId, actorUserId, createDto)).rejects.toThrow(
      'User with this email already exists in the tenant.',
    );
  });

  it('should allow creation if email exists in another tenant', async () => {
    mockDesignationRepo.findOne.mockResolvedValue({
      id: 'desig-uuid',
      department: { tenant_id: tenantId },
    });
    mockUserRepo.findOne.mockImplementation((opts: { where?: { email?: string; id?: string } }) => {
      if (opts?.where?.email) {
        return Promise.resolve(null);
      }
      if (opts?.where?.id === 'user-uuid') {
        return Promise.resolve({
          id: 'user-uuid',
          email: createDto.email,
          first_name: createDto.first_name,
          last_name: createDto.last_name,
        });
      }
      return Promise.resolve(null);
    });

    mockUserRepo.create.mockReturnValue({ ...createDto, id: 'user-uuid' });
    mockUserRepo.save.mockResolvedValue({ ...createDto, id: 'user-uuid' });
    mockEmployeeRepo.create.mockReturnValue({
      id: 'emp-uuid',
      user_id: 'user-uuid',
      designation_id: 'desig-uuid',
    });
    mockEmployeeRepo.save.mockResolvedValue({
      id: 'emp-uuid',
      user_id: 'user-uuid',
      designation_id: 'desig-uuid',
    });

    const result = await service.create(tenantId, actorUserId, createDto);
    expect(result).toEqual({
      id: 'emp-uuid',
      user_id: 'user-uuid',
      designation_id: 'desig-uuid',
    });
  });

  it('should use provided role_id if given', async () => {
    mockDesignationRepo.findOne.mockResolvedValue({
      id: 'desig-uuid',
      department: { tenant_id: tenantId },
    });
    mockUserRepo.findOne.mockImplementation((opts: { where?: { email?: string; id?: string } }) => {
      if (opts?.where?.email) {
        return Promise.resolve(null);
      }
      if (opts?.where?.id === 'user-uuid') {
        return Promise.resolve({
          id: 'user-uuid',
          email: createDto.email,
          first_name: createDto.first_name,
          last_name: createDto.last_name,
        });
      }
      return Promise.resolve(null);
    });
    mockRoleRepo.findOne.mockImplementation((opts: { where?: { id?: string } }) => {
      if (opts?.where?.id === customRoleId) {
        return Promise.resolve({ id: customRoleId, name: 'HR Admin' });
      }
      return Promise.resolve(null);
    });
    mockUserRepo.create.mockReturnValue({ ...createDto, id: 'user-uuid', role_id: customRoleId });
    mockUserRepo.save.mockResolvedValue({ ...createDto, id: 'user-uuid', role_id: customRoleId });
    mockEmployeeRepo.create.mockReturnValue({
      id: 'emp-uuid',
      user_id: 'user-uuid',
      designation_id: 'desig-uuid',
    });
    mockEmployeeRepo.save.mockResolvedValue({
      id: 'emp-uuid',
      user_id: 'user-uuid',
      designation_id: 'desig-uuid',
    });

    const result = await service.create(tenantId, actorUserId, { ...createDto, role_id: customRoleId });
    expect(result).toEqual({
      id: 'emp-uuid',
      user_id: 'user-uuid',
      designation_id: 'desig-uuid',
    });
  });

  it('should throw NotFoundException if provided role_id does not exist', async () => {
    mockDesignationRepo.findOne.mockResolvedValue({
      id: 'desig-uuid',
      department: { tenant_id: tenantId },
    });
    mockUserRepo.findOne.mockResolvedValue(null);
    mockRoleRepo.findOne.mockResolvedValue(null);
    await expect(service.create(tenantId, actorUserId, { ...createDto, role_id: nonExistentRoleId })).rejects.toThrow(
      'Specified role not found.',
    );
  });
});
