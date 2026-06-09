import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { Leave } from '../../entities/leave.entity';
import { LeaveType } from '../../entities/leave-type.entity';
import { User } from '../../entities/user.entity';
import { Employee } from '../../entities/employee.entity';
import { Team } from '../../entities/team.entity';
import { LeaveStatus } from '../../common/constants/enums';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { LeaveFileUploadService } from './services/leave-file-upload.service';
import { S3StorageService } from '../storage/storage.service';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { WorkflowService } from '../workflow/workflow.service';
import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';
import { LeaveBalance } from '../../entities/leave-balance.entity';
import { EmailService } from '../../common/utils/email';
import { NotificationsEmailService } from '../notifications-email/notifications-email.service';
import { CalendarCacheService } from '../calendar/calendar-cache.service';

// ── Fixture helpers ──────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-aaa';
const LEAVE_ID = 'leave-111';
const EMPLOYEE_USER_ID = 'user-employee-001';
const MANAGER_USER_ID = 'user-manager-001';
const ADMIN_USER_ID = 'user-admin-001';
const TEAM_ID = 'team-001';

function makeLeave(overrides: Partial<Leave> = {}): Leave {
  return {
    id: LEAVE_ID,
    tenantId: TENANT_ID,
    employeeId: EMPLOYEE_USER_ID,
    status: LeaveStatus.PENDING,
    approvedBy: null,
    approvedAt: null,
    remarks: '',
    employee: null,
    leaveType: null,
    approver: null,
    ...overrides,
  } as unknown as Leave;
}

function makeUser(id: string, roleName: string): User {
  return {
    id,
    role: {
      id: 'role-id',
      name: roleName,
      description: '',
      users: [],
      rolePermissions: [],
    },
    role_id: 'role-id',
    email: `${roleName}@test.com`,
    first_name: roleName,
    last_name: 'User',
  } as unknown as User;
}

function makeEmployee(
  userId: string,
  managerId: string | null = null,
): Employee {
  return {
    id: 'emp-001',
    user_id: userId,
    team: managerId ? ({ id: TEAM_ID, manager_id: managerId } as Team) : null,
  } as unknown as Employee;
}

// ── Mock factories ───────────────────────────────────────────────────────────

const mockLeaveRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn().mockImplementation((leave: Leave) => Promise.resolve(leave)),
  find: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
});

const mockLeaveBalanceRepo = () => ({
  findOne: jest.fn().mockResolvedValue({
    id: 'bal-1',
    used: 0,
    year: new Date().getFullYear(),
  }),
  save: jest.fn().mockImplementation((b: unknown) => Promise.resolve(b)),
});

const mockLeaveTypeRepo = () => ({ findOne: jest.fn() });
const mockUserRepo = () => ({ findOne: jest.fn() });
const mockEmployeeRepo = () => ({ findOne: jest.fn() });
const mockTeamRepo = () => ({ findOne: jest.fn() });

const mockDataSource = () => ({
  query: jest.fn().mockResolvedValue([{ schema_provisioned: false }]),
});

const mockNotif = {
  id: 'notif-1',
  message: 'test',
  type: 'leave',
  created_at: new Date(),
};
const mockNotificationService = () => ({
  create: jest.fn().mockResolvedValue(mockNotif),
  notifyLeaveProcessing: jest.fn().mockResolvedValue(mockNotif),
  notifyLeaveFinalDecision: jest.fn().mockResolvedValue(mockNotif),
  markAsReadForRelatedEntity: jest.fn(),
});

const mockNotificationGateway = () => ({
  sendToUser: jest.fn(),
});

const mockTenantDbService = () => ({
  withTenantSchema: jest.fn(),
  withTenantSchemaReadOnly: jest.fn(),
});

const mockWorkflowService = () => ({
  isWorkflowEnabled: jest.fn().mockResolvedValue(false),
  getWorkflowSteps: jest.fn().mockResolvedValue([]),
});

const mockTenantSettingsService = () => ({
  getSettings: jest.fn().mockResolvedValue(null),
});

// ── Test suite ───────────────────────────────────────────────────────────────

describe('LeaveService', () => {
  let service: LeaveService;
  let leaveRepo: ReturnType<typeof mockLeaveRepo>;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let employeeRepo: ReturnType<typeof mockEmployeeRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: getRepositoryToken(Leave), useFactory: mockLeaveRepo },
        {
          provide: getRepositoryToken(LeaveBalance),
          useFactory: mockLeaveBalanceRepo,
        },
        {
          provide: getRepositoryToken(LeaveType),
          useFactory: mockLeaveTypeRepo,
        },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(Employee), useFactory: mockEmployeeRepo },
        { provide: getRepositoryToken(Team), useFactory: mockTeamRepo },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: NotificationService, useFactory: mockNotificationService },
        { provide: NotificationGateway, useFactory: mockNotificationGateway },
        { provide: LeaveFileUploadService, useValue: {} },
        { provide: S3StorageService, useValue: {} },
        { provide: TenantDatabaseService, useFactory: mockTenantDbService },
        { provide: WorkflowService, useFactory: mockWorkflowService },
        {
          provide: TenantSettingsService,
          useFactory: mockTenantSettingsService,
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: () => Promise.resolve(),
            sendLeaveStatusEmail: () => Promise.resolve(),
          },
        },
        {
          provide: NotificationsEmailService,
          useValue: {
            sendLeaveRequestNotification: () => undefined,
            sendLeaveStatusUpdate: () => undefined,
            sendStepApprovedToEmployee: () => undefined,
            sendPendingApprovalToApprover: () => undefined,
          },
        },
        {
          provide: CalendarCacheService,
          useValue: { invalidate: () => undefined },
        },
      ],
    }).compile();

    service = module.get<LeaveService>(LeaveService);
    leaveRepo = module.get(getRepositoryToken(Leave));
    userRepo = module.get(getRepositoryToken(User));
    employeeRepo = module.get(getRepositoryToken(Employee));
  });

  // ── approveLeave ───────────────────────────────────────────────────────────

  describe('approveLeave', () => {
    it('throws NotFoundException when leave does not exist', async () => {
      leaveRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approveLeave(LEAVE_ID, ADMIN_USER_ID, TENANT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when leave is already APPROVED', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.APPROVED }),
      );

      await expect(
        service.approveLeave(LEAVE_ID, ADMIN_USER_ID, TENANT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when leave is REJECTED', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.REJECTED }),
      );

      await expect(
        service.approveLeave(LEAVE_ID, ADMIN_USER_ID, TENANT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('manager approving PENDING leave moves status to PROCESSING', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.PENDING }),
      );
      employeeRepo.findOne.mockResolvedValue(
        makeEmployee(EMPLOYEE_USER_ID, MANAGER_USER_ID),
      );
      // Manager is NOT an admin
      userRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === MANAGER_USER_ID)
            return Promise.resolve(makeUser(MANAGER_USER_ID, 'manager'));
          if (where.id === EMPLOYEE_USER_ID)
            return Promise.resolve(makeUser(EMPLOYEE_USER_ID, 'employee'));
          return Promise.resolve(null);
        },
      );

      const result = await service.approveLeave(
        LEAVE_ID,
        MANAGER_USER_ID,
        TENANT_ID,
        'Looks good',
      );

      expect(result.status).toBe(LeaveStatus.PROCESSING);
      expect(result.approvedBy).toBe(MANAGER_USER_ID);
      expect(result.remarks).toBe('Looks good');
    });

    it('admin approving PENDING leave moves status directly to APPROVED', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.PENDING }),
      );
      employeeRepo.findOne.mockResolvedValue(
        makeEmployee(EMPLOYEE_USER_ID, null),
      ); // no manager
      userRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === ADMIN_USER_ID)
            return Promise.resolve(makeUser(ADMIN_USER_ID, 'admin'));
          return Promise.resolve(null);
        },
      );

      const result = await service.approveLeave(
        LEAVE_ID,
        ADMIN_USER_ID,
        TENANT_ID,
        'Approved',
      );

      expect(result.status).toBe(LeaveStatus.APPROVED);
      expect(result.approvedBy).toBe(ADMIN_USER_ID);
    });

    it('admin approving PROCESSING leave moves status to APPROVED', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.PROCESSING }),
      );
      employeeRepo.findOne.mockResolvedValue(
        makeEmployee(EMPLOYEE_USER_ID, MANAGER_USER_ID),
      );
      userRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === ADMIN_USER_ID)
            return Promise.resolve(makeUser(ADMIN_USER_ID, 'admin'));
          return Promise.resolve(null);
        },
      );

      const result = await service.approveLeave(
        LEAVE_ID,
        ADMIN_USER_ID,
        TENANT_ID,
      );

      expect(result.status).toBe(LeaveStatus.APPROVED);
    });

    it('throws ForbiddenException when manager tries to approve a PROCESSING leave', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.PROCESSING }),
      );
      employeeRepo.findOne.mockResolvedValue(
        makeEmployee(EMPLOYEE_USER_ID, MANAGER_USER_ID),
      );
      userRepo.findOne.mockResolvedValue(makeUser(MANAGER_USER_ID, 'manager'));

      await expect(
        service.approveLeave(LEAVE_ID, MANAGER_USER_ID, TENANT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when an unrelated user tries to approve', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.PENDING }),
      );
      employeeRepo.findOne.mockResolvedValue(
        makeEmployee(EMPLOYEE_USER_ID, 'some-other-manager'),
      );
      userRepo.findOne.mockResolvedValue(makeUser('random-user', 'employee'));

      await expect(
        service.approveLeave(LEAVE_ID, 'random-user', TENANT_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── rejectLeave ────────────────────────────────────────────────────────────

  describe('rejectLeave', () => {
    it('throws NotFoundException when leave does not exist', async () => {
      leaveRepo.findOne.mockResolvedValue(null);

      await expect(
        service.rejectLeave(LEAVE_ID, ADMIN_USER_ID, TENANT_ID, 'reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when leave is already APPROVED', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.APPROVED }),
      );

      await expect(
        service.rejectLeave(LEAVE_ID, ADMIN_USER_ID, TENANT_ID, 'reason'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when leave is CANCELLED', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.CANCELLED }),
      );

      await expect(
        service.rejectLeave(LEAVE_ID, ADMIN_USER_ID, TENANT_ID, 'reason'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('manager can reject a PENDING leave', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.PENDING }),
      );
      employeeRepo.findOne.mockResolvedValue(
        makeEmployee(EMPLOYEE_USER_ID, MANAGER_USER_ID),
      );
      userRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === MANAGER_USER_ID)
            return Promise.resolve(makeUser(MANAGER_USER_ID, 'manager'));
          if (where.id === EMPLOYEE_USER_ID)
            return Promise.resolve(makeUser(EMPLOYEE_USER_ID, 'employee'));
          return Promise.resolve(null);
        },
      );

      const result = await service.rejectLeave(
        LEAVE_ID,
        MANAGER_USER_ID,
        TENANT_ID,
        'Not eligible',
      );

      expect(result.status).toBe(LeaveStatus.REJECTED);
      expect(result.approvedBy).toBe(MANAGER_USER_ID);
      expect(result.remarks).toBe('Not eligible');
    });

    it('admin can reject a PENDING leave', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.PENDING }),
      );
      employeeRepo.findOne.mockResolvedValue(
        makeEmployee(EMPLOYEE_USER_ID, null),
      );
      userRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === ADMIN_USER_ID)
            return Promise.resolve(makeUser(ADMIN_USER_ID, 'admin'));
          return Promise.resolve(null);
        },
      );

      const result = await service.rejectLeave(
        LEAVE_ID,
        ADMIN_USER_ID,
        TENANT_ID,
        'Rejected',
      );

      expect(result.status).toBe(LeaveStatus.REJECTED);
    });

    it('admin can reject a PROCESSING leave', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.PROCESSING }),
      );
      employeeRepo.findOne.mockResolvedValue(
        makeEmployee(EMPLOYEE_USER_ID, MANAGER_USER_ID),
      );
      userRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === ADMIN_USER_ID)
            return Promise.resolve(makeUser(ADMIN_USER_ID, 'admin'));
          return Promise.resolve(null);
        },
      );

      const result = await service.rejectLeave(
        LEAVE_ID,
        ADMIN_USER_ID,
        TENANT_ID,
        'Policy breach',
      );

      expect(result.status).toBe(LeaveStatus.REJECTED);
      expect(result.remarks).toBe('Policy breach');
    });

    it('throws ForbiddenException when unrelated user tries to reject', async () => {
      leaveRepo.findOne.mockResolvedValue(
        makeLeave({ status: LeaveStatus.PENDING }),
      );
      employeeRepo.findOne.mockResolvedValue(
        makeEmployee(EMPLOYEE_USER_ID, 'other-manager'),
      );
      userRepo.findOne.mockResolvedValue(makeUser('random-user', 'employee'));

      await expect(
        service.rejectLeave(LEAVE_ID, 'random-user', TENANT_ID, 'reason'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
