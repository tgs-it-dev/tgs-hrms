import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotificationsEmailService } from './notifications-email.service';
import { NotificationLog } from '../../entities/notification-log.entity';
import { User } from '../../entities/user.entity';
import { EmailService } from '../../common/utils/email/email.service';
import {
  NotificationLogStatus,
  LeaveStatus,
  WorkflowRequestType,
} from '../../common/constants/enums';

// ── Fixtures ────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
    tenant_id: 'tenant-1',
    email_notifications_enabled: true,
    ...overrides,
  }) as User;

const leaveRequest = {
  id: 'leave-1',
  tenantId: 'tenant-1',
  startDate: '2026-06-01',
  endDate: '2026-06-03',
  totalDays: 3,
  reason: 'Holiday',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationsEmailService', () => {
  let service: NotificationsEmailService;
  let emailService: { sendEmail: jest.Mock };
  let logRepo: { save: jest.Mock; create: jest.Mock };
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    logRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockResolvedValue(undefined),
    };
    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsEmailService,
        { provide: getRepositoryToken(NotificationLog), useValue: logRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: EmailService, useValue: emailService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => fallback ?? ''),
          },
        },
      ],
    }).compile();

    service = module.get(NotificationsEmailService);
  });

  describe('sendLeaveRequestNotification', () => {
    it('sends email and writes SENT log when manager has notifications enabled', async () => {
      const manager = makeUser({ id: 'mgr-1', email: 'mgr@example.com' });
      const employee = makeUser({ id: 'emp-1', email: 'emp@example.com' });
      userRepo.findOne
        .mockResolvedValueOnce(manager) // resolveUsers: manager
        .mockResolvedValueOnce(employee); // resolveUsers: employee

      service.sendLeaveRequestNotification('mgr-1', 'emp-1', leaveRequest);
      await flushPromises();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'mgr@example.com',
        expect.stringContaining('New Leave Request'),
        expect.any(String),
        undefined,
        'mgr-1',
      );
      expect(logRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: NotificationLogStatus.SENT }),
      );
    });

    it('skips email and writes no log when manager has notifications disabled', async () => {
      const manager = makeUser({
        id: 'mgr-1',
        email_notifications_enabled: false,
      });
      const employee = makeUser({ id: 'emp-1' });
      userRepo.findOne
        .mockResolvedValueOnce(manager)
        .mockResolvedValueOnce(employee);

      service.sendLeaveRequestNotification('mgr-1', 'emp-1', leaveRequest);
      await flushPromises();

      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(logRepo.save).not.toHaveBeenCalled();
    });

    it('writes FAILED log and does not throw when sendEmail rejects', async () => {
      const manager = makeUser({ id: 'mgr-1', email: 'mgr@example.com' });
      const employee = makeUser({ id: 'emp-1' });
      userRepo.findOne
        .mockResolvedValueOnce(manager)
        .mockResolvedValueOnce(employee);
      emailService.sendEmail.mockRejectedValue(new Error('SMTP timeout'));

      service.sendLeaveRequestNotification('mgr-1', 'emp-1', leaveRequest);
      await flushPromises();

      expect(logRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: NotificationLogStatus.FAILED,
          error_message: 'SMTP timeout',
        }),
      );
    });
  });

  describe('sendLeaveStatusUpdate', () => {
    it('sends approved status email to employee', async () => {
      const employee = makeUser({ id: 'emp-1', email: 'emp@example.com' });
      userRepo.findOne.mockResolvedValueOnce(employee);

      service.sendLeaveStatusUpdate(
        'emp-1',
        leaveRequest,
        LeaveStatus.APPROVED,
      );
      await flushPromises();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'emp@example.com',
        expect.stringContaining('approved'),
        expect.any(String),
        undefined,
        'emp-1',
      );
    });
  });

  describe('sendPendingApprovalToApprover', () => {
    it('sends email using pre-fetched approver and employee without additional DB queries', async () => {
      const approver = makeUser({ id: 'apr-1', email: 'apr@example.com' });
      const employee = makeUser({
        id: 'emp-1',
        first_name: 'Jane',
        last_name: 'Smith',
      });
      const context = {
        id: 'req-1',
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        requestType: WorkflowRequestType.LEAVE as const,
      };

      service.sendPendingApprovalToApprover(
        approver,
        employee,
        context,
        'Admin Approval',
      );
      await flushPromises();

      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'apr@example.com',
        expect.stringContaining('Admin Approval'),
        expect.any(String),
        undefined,
        'apr-1',
      );
    });
  });

  describe('HTML escaping', () => {
    it('escapes XSS in first_name when building leave request email', async () => {
      const manager = makeUser({
        id: 'mgr-1',
        email: 'mgr@example.com',
        first_name: '<script>alert(1)</script>',
      });
      const employee = makeUser({ id: 'emp-1', last_name: '<img onerror=x>' });
      userRepo.findOne
        .mockResolvedValueOnce(manager)
        .mockResolvedValueOnce(employee);

      service.sendLeaveRequestNotification('mgr-1', 'emp-1', leaveRequest);
      await flushPromises();

      const html: string = emailService.sendEmail.mock.calls[0][2];
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img onerror=x>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
