import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { AuthenticatedRequest } from '../../common/types/request.types';
import { UserRole } from '../../common/constants/enums';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-aaa';
const OTHER_TENANT_ID = 'tenant-bbb';
const USER_ID = 'user-001';
const TEAM_ID = 'team-xyz';

function makeReq(role: string, tenantId = TENANT_ID): AuthenticatedRequest {
  return {
    user: {
      id: USER_ID,
      email: 'u@test.com',
      first_name: 'Test',
      last_name: 'User',
      role,
      tenant_id: tenantId,
      permissions: [],
    },
  } as unknown as AuthenticatedRequest;
}

const baseQuery = { from: '2025-06-01', to: '2025-06-30' };

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CalendarController', () => {
  let controller: CalendarController;
  let calendarService: jest.Mocked<
    Pick<CalendarService, 'getTeamCalendar' | 'resolveTimezone'>
  >;

  beforeEach(async () => {
    calendarService = {
      getTeamCalendar: jest.fn().mockResolvedValue([]),
      resolveTimezone: jest.fn().mockReturnValue('UTC'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarController],
      providers: [{ provide: CalendarService, useValue: calendarService }],
    }).compile();

    controller = module.get(CalendarController);
  });

  // ── System-admin guard ────────────────────────────────────────────────────

  describe('system-admin access', () => {
    it('throws BadRequestException when system-admin omits tenantId', async () => {
      const req = makeReq(UserRole.SYSTEM_ADMIN);

      await expect(
        controller.getCalendar(req, { ...baseQuery }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when system-admin omits teamId', async () => {
      const req = makeReq(UserRole.SYSTEM_ADMIN);

      await expect(
        controller.getCalendar(
          req,
          { ...baseQuery, tenantId: OTHER_TENANT_ID },
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls service with the provided tenantId and teamId when system-admin', () => {
      const req = makeReq(UserRole.SYSTEM_ADMIN);

      void controller.getCalendar(
        req,
        { ...baseQuery, tenantId: OTHER_TENANT_ID, teamId: TEAM_ID },
        undefined,
      );

      expect(calendarService.getTeamCalendar).toHaveBeenCalledWith(
        OTHER_TENANT_ID,
        '2025-06-01',
        '2025-06-30',
        TEAM_ID,
        'UTC',
        USER_ID,
        UserRole.SYSTEM_ADMIN,
      );
    });
  });

  // ── Admin role guard ───────────────────────────────────────────────────────

  describe('admin role access', () => {
    it('throws BadRequestException when admin omits teamId', async () => {
      const req = makeReq(UserRole.ADMIN);

      await expect(
        controller.getCalendar(req, { ...baseQuery }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when hr-admin omits teamId', async () => {
      const req = makeReq(UserRole.HR_ADMIN);

      await expect(
        controller.getCalendar(req, { ...baseQuery }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when network-admin omits teamId', async () => {
      const req = makeReq(UserRole.NETWORK_ADMIN);

      await expect(
        controller.getCalendar(req, { ...baseQuery }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls service with tenantId from token when admin with teamId', () => {
      const req = makeReq(UserRole.ADMIN);

      void controller.getCalendar(
        req,
        { ...baseQuery, teamId: TEAM_ID },
        undefined,
      );

      expect(calendarService.getTeamCalendar).toHaveBeenCalledWith(
        TENANT_ID,
        '2025-06-01',
        '2025-06-30',
        TEAM_ID,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );
    });
  });

  // ── Regular-user tenant isolation ─────────────────────────────────────────

  describe('regular user access', () => {
    it('uses the token tenant_id for non-admin users', () => {
      const req = makeReq(UserRole.EMPLOYEE);

      void controller.getCalendar(req, baseQuery, undefined);

      expect(calendarService.getTeamCalendar).toHaveBeenCalledWith(
        TENANT_ID,
        expect.any(String),
        expect.any(String),
        undefined,
        'UTC',
        USER_ID,
        UserRole.EMPLOYEE,
      );
    });

    it('ignores a tenantId query param sent by a non-admin user', () => {
      const req = makeReq(UserRole.EMPLOYEE);

      void controller.getCalendar(
        req,
        { ...baseQuery, tenantId: OTHER_TENANT_ID },
        undefined,
      );

      // Must use the token tenant, NOT the query-param tenant.
      expect(calendarService.getTeamCalendar).toHaveBeenCalledWith(
        TENANT_ID, // from JWT, not query
        expect.any(String),
        expect.any(String),
        undefined,
        'UTC',
        USER_ID,
        UserRole.EMPLOYEE,
      );
    });

    it('ignores teamId when employee requests calendar (server-side scoping)', () => {
      const req = makeReq(UserRole.EMPLOYEE);

      void controller.getCalendar(
        req,
        { ...baseQuery, teamId: TEAM_ID },
        undefined,
      );

      // Employee self-view ignores any teamId — service scopes to the user
      expect(calendarService.getTeamCalendar).toHaveBeenCalledWith(
        TENANT_ID,
        expect.any(String),
        expect.any(String),
        TEAM_ID, // passed through, but service will ignore it for EMPLOYEE role
        'UTC',
        USER_ID,
        UserRole.EMPLOYEE,
      );
    });

    it('passes teamId through to the service for manager role', () => {
      const req = makeReq(UserRole.MANAGER);

      void controller.getCalendar(
        req,
        { ...baseQuery, teamId: TEAM_ID },
        undefined,
      );

      expect(calendarService.getTeamCalendar).toHaveBeenCalledWith(
        TENANT_ID,
        expect.any(String),
        expect.any(String),
        TEAM_ID,
        'UTC',
        USER_ID,
        UserRole.MANAGER,
      );
    });
  });

  // ── Timezone resolution ───────────────────────────────────────────────────

  describe('timezone resolution', () => {
    it('passes query-param timezone to resolveTimezone', () => {
      const req = makeReq(UserRole.EMPLOYEE);

      void controller.getCalendar(
        req,
        { ...baseQuery, timezone: 'Asia/Karachi' },
        undefined,
      );

      expect(calendarService.resolveTimezone).toHaveBeenCalledWith(
        'Asia/Karachi',
        undefined,
      );
    });

    it('passes X-Timezone header to resolveTimezone as fallback', () => {
      const req = makeReq(UserRole.EMPLOYEE);

      void controller.getCalendar(req, baseQuery, 'America/New_York');

      expect(calendarService.resolveTimezone).toHaveBeenCalledWith(
        undefined,
        'America/New_York',
      );
    });

    it('resolved timezone is forwarded to getTeamCalendar', () => {
      calendarService.resolveTimezone.mockReturnValue('Asia/Karachi');
      const req = makeReq(UserRole.EMPLOYEE);

      void controller.getCalendar(
        req,
        { ...baseQuery, timezone: 'Asia/Karachi' },
        undefined,
      );

      expect(calendarService.getTeamCalendar).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        'Asia/Karachi',
        USER_ID,
        UserRole.EMPLOYEE,
      );
    });
  });
});
