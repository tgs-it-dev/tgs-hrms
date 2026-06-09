import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { AuthenticatedRequest } from '../../common/types/request.types';
import { UserRole } from '../../common/constants/enums';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-aaa';
const OTHER_TENANT_ID = 'tenant-bbb';

function makeReq(role: string, tenantId = TENANT_ID): AuthenticatedRequest {
  return {
    user: {
      id: 'user-001',
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
    it('throws BadRequestException when system-admin omits tenantId', () => {
      const req = makeReq(UserRole.SYSTEM_ADMIN);

      expect(() =>
        controller.getCalendar(req, { ...baseQuery }, undefined),
      ).toThrow(BadRequestException);
    });

    it('calls service with the provided tenantId when system-admin', () => {
      const req = makeReq(UserRole.SYSTEM_ADMIN);

      void controller.getCalendar(
        req,
        { ...baseQuery, tenantId: OTHER_TENANT_ID },
        undefined,
      );

      expect(calendarService.getTeamCalendar).toHaveBeenCalledWith(
        OTHER_TENANT_ID,
        '2025-06-01',
        '2025-06-30',
        undefined,
        'UTC',
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
      );
    });

    it('passes teamId through to the service', () => {
      const req = makeReq(UserRole.MANAGER);

      void controller.getCalendar(
        req,
        { ...baseQuery, teamId: 'team-xyz' },
        undefined,
      );

      expect(calendarService.getTeamCalendar).toHaveBeenCalledWith(
        TENANT_ID,
        expect.any(String),
        expect.any(String),
        'team-xyz',
        'UTC',
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
      );
    });
  });
});
