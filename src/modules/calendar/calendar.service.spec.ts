import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { CalendarService, MemberCalendar } from './calendar.service';
import { UserRole } from '../../common/constants/enums';
import { CalendarCacheService } from './calendar-cache.service';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

// ── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-aaa';
const USER_ID = 'user-001';
const USER_FIRST = 'Jane';
const USER_LAST = 'Doe';

// ── Raw row factories (one per query) ─────────────────────────────────────────

function makeEmployee(
  overrides: { user_id?: string; first_name?: string; last_name?: string } = {},
) {
  return {
    user_id: overrides.user_id ?? USER_ID,
    first_name: overrides.first_name ?? USER_FIRST,
    last_name: overrides.last_name ?? USER_LAST,
  };
}

function makeLeave(date: string, employeeId = USER_ID) {
  return { employeeId: employeeId, start_date: date, end_date: date };
}

function makeWfh(date: string, employeeId = USER_ID) {
  return { employee_id: employeeId, start_date: date, end_date: date };
}

function makeAttendance(date: string, userId = USER_ID) {
  return { user_id: userId, att_date: date };
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

interface MockData {
  employees?: ReturnType<typeof makeEmployee>[];
  leaves?: ReturnType<typeof makeLeave>[];
  wfhs?: ReturnType<typeof makeWfh>[];
  attendances?: ReturnType<typeof makeAttendance>[];
}

// Routes each query to the appropriate result set based on a unique SQL token.
function makeQueryFn(data: MockData, onCalendarQuery: () => void) {
  return (sql: string) => {
    if (sql.includes('schema_provisioned')) {
      return Promise.resolve([{ schema_provisioned: false }]);
    }
    onCalendarQuery();
    if (sql.includes('u.first_name'))
      return Promise.resolve(data.employees ?? []);
    if (sql.includes('FROM leaves')) return Promise.resolve(data.leaves ?? []);
    if (sql.includes('wfh_requests')) return Promise.resolve(data.wfhs ?? []);
    if (sql.includes("type = 'check-in'"))
      return Promise.resolve(data.attendances ?? []);
    return Promise.resolve([]);
  };
}

function makeTenantDbService(data: MockData) {
  return {
    withTenantSchemaReadOnly: jest
      .fn()
      .mockImplementation(
        (
          _tenantId: string,
          cb: (em: {
            query: (sql: string) => Promise<unknown[]>;
          }) => Promise<unknown[]>,
        ) => {
          const em = {
            query: (sql: string) => {
              if (sql.includes('u.first_name'))
                return Promise.resolve(data.employees ?? []);
              if (sql.includes('FROM leaves'))
                return Promise.resolve(data.leaves ?? []);
              if (sql.includes('wfh_requests'))
                return Promise.resolve(data.wfhs ?? []);
              if (sql.includes("type = 'check-in'"))
                return Promise.resolve(data.attendances ?? []);
              return Promise.resolve([]);
            },
          };
          return cb(em);
        },
      ),
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CalendarService', () => {
  let service: CalendarService;
  let cacheService: CalendarCacheService;
  let tenantDbService: ReturnType<typeof makeTenantDbService>;
  // Counts dataSource.query calls that are NOT the schema_provisioned check.
  let calendarQueryCount = 0;

  async function buildModule(data: MockData = {}, provisioned = false) {
    calendarQueryCount = 0;
    tenantDbService = makeTenantDbService(data);

    const baseQueryFn = makeQueryFn(data, () => calendarQueryCount++);
    const mockDataSource = {
      query: (sql: string) => {
        if (provisioned && sql.includes('schema_provisioned')) {
          return Promise.resolve([{ schema_provisioned: true }]);
        }
        return baseQueryFn(sql);
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        CalendarCacheService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: TenantDatabaseService, useValue: tenantDbService },
      ],
    }).compile();

    service = module.get(CalendarService);
    cacheService = module.get(CalendarCacheService);
    jest.useFakeTimers();
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── resolveTimezone ───────────────────────────────────────────────────────

  describe('resolveTimezone', () => {
    beforeEach(() => buildModule());

    it('returns a valid query-param timezone', () => {
      expect(service.resolveTimezone('Asia/Karachi')).toBe('Asia/Karachi');
    });

    it('falls through to the header timezone when query param is invalid', () => {
      expect(service.resolveTimezone('INVALID_TZ', 'America/New_York')).toBe(
        'America/New_York',
      );
    });

    it('returns UTC when both params are absent', () => {
      expect(service.resolveTimezone()).toBe('UTC');
    });

    it('returns UTC when both params are invalid', () => {
      expect(service.resolveTimezone('bad', 'also-bad')).toBe('UTC');
    });

    it('query param takes precedence over header when both valid', () => {
      expect(service.resolveTimezone('Asia/Karachi', 'America/New_York')).toBe(
        'Asia/Karachi',
      );
    });
  });

  // ── caching behaviour ─────────────────────────────────────────────────────

  describe('caching', () => {
    it('non-provisioned: hits the DB on a cache miss', async () => {
      await buildModule({ employees: [makeEmployee()] });

      await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(calendarQueryCount).toBeGreaterThan(0);
    });

    it('non-provisioned: cache hit skips the DB on a second identical call', async () => {
      await buildModule({ employees: [makeEmployee()] });

      await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );
      const countAfterFirst = calendarQueryCount;
      await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(calendarQueryCount).toBe(countAfterFirst); // no new queries
    });

    it('non-provisioned: re-queries after the 60 s TTL expires', async () => {
      await buildModule({ employees: [makeEmployee()] });

      await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );
      const countAfterFirst = calendarQueryCount;
      jest.advanceTimersByTime(60_001);
      await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(calendarQueryCount).toBeGreaterThan(countAfterFirst);
    });

    it('non-provisioned: different date ranges are cached independently', async () => {
      await buildModule({ employees: [makeEmployee()] });

      await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-01',
        '2025-06-30',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );
      const countAfterFirst = calendarQueryCount;
      await service.getTeamCalendar(
        TENANT_ID,
        '2025-07-01',
        '2025-07-31',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(calendarQueryCount).toBeGreaterThan(countAfterFirst);
    });

    it('non-provisioned: invalidating the tenant forces a re-query', async () => {
      await buildModule({ employees: [makeEmployee()] });

      await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );
      const countAfterFirst = calendarQueryCount;
      cacheService.invalidate(TENANT_ID);
      await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(calendarQueryCount).toBeGreaterThan(countAfterFirst);
    });

    it('provisioned: routes all queries through withTenantSchemaReadOnly', async () => {
      await buildModule({ employees: [makeEmployee()] }, true);

      await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      // employees + leaves + wfh + attendance = 4 schema-routed calls
      expect(tenantDbService.withTenantSchemaReadOnly).toHaveBeenCalledTimes(4);
      expect(calendarQueryCount).toBe(0); // nothing hit the public dataSource
    });
  });

  // ── empty result ──────────────────────────────────────────────────────────

  describe('empty results', () => {
    it('returns an empty array when there are no employees', async () => {
      await buildModule({ employees: [] });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-01',
        '2025-06-30',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(result).toEqual([]);
    });

    it('returns a member with empty dates when every day is a weekend with no attendance', async () => {
      await buildModule({ employees: [makeEmployee()] });

      // 2025-06-07 = Saturday, 2025-06-08 = Sunday
      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-07',
        '2025-06-08',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(result).toHaveLength(1);
      expect(result[0].dates).toHaveLength(0);
    });
  });

  // ── status derivation ─────────────────────────────────────────────────────

  describe('status derivation', () => {
    it('ON_LEAVE takes priority over WFH and attendance', async () => {
      await buildModule({
        employees: [makeEmployee()],
        leaves: [makeLeave('2025-06-04')],
        wfhs: [makeWfh('2025-06-04')],
        attendances: [makeAttendance('2025-06-04')],
      });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expectSingleStatus(result, '2025-06-04', 'ON_LEAVE');
    });

    it('ON_LEAVE takes priority even with no attendance', async () => {
      await buildModule({
        employees: [makeEmployee()],
        leaves: [makeLeave('2025-06-04')],
      });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expectSingleStatus(result, '2025-06-04', 'ON_LEAVE');
    });

    it('WFH is returned when there is no leave', async () => {
      await buildModule({
        employees: [makeEmployee()],
        wfhs: [makeWfh('2025-06-04')],
      });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expectSingleStatus(result, '2025-06-04', 'WFH');
    });

    it('PRESENT when the employee has a check-in on a weekday', async () => {
      await buildModule({
        employees: [makeEmployee()],
        attendances: [makeAttendance('2025-06-04')],
      });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expectSingleStatus(result, '2025-06-04', 'PRESENT');
    });

    it('ABSENT on a weekday with no attendance and no leave/WFH', async () => {
      await buildModule({ employees: [makeEmployee()] });

      // 2025-06-04 = Wednesday
      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expectSingleStatus(result, '2025-06-04', 'ABSENT');
    });

    it('WEEKEND_WORK when an employee checks in on a Saturday', async () => {
      await buildModule({
        employees: [makeEmployee()],
        attendances: [makeAttendance('2025-06-07')], // 2025-06-07 = Saturday
      });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-07',
        '2025-06-07',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expectSingleStatus(result, '2025-06-07', 'WEEKEND_WORK');
    });

    it('weekend with no attendance is omitted from dates array', async () => {
      await buildModule({ employees: [makeEmployee()] });

      // 2025-06-08 = Sunday, no attendance
      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-08',
        '2025-06-08',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(result).toHaveLength(1);
      expect(result[0].dates).toHaveLength(0);
    });
  });

  // ── role-based scoping ────────────────────────────────────────────────────

  describe('role-based scoping', () => {
    it('employee role fetches only their own data (self-view)', async () => {
      await buildModule({ employees: [makeEmployee()] });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.EMPLOYEE,
      );

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(USER_ID);
    });

    it('employee self-view returns empty when user is not found', async () => {
      await buildModule({ employees: [] });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        'nonexistent-user',
        UserRole.EMPLOYEE,
      );

      expect(result).toEqual([]);
    });

    it('employee self-view returns data even when teamId is passed', async () => {
      await buildModule({ employees: [makeEmployee()] });

      // teamId is passed but should be ignored for EMPLOYEE role
      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        'some-team-id',
        'UTC',
        USER_ID,
        UserRole.EMPLOYEE,
      );

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(USER_ID);
    });

    it('manager without any teams returns empty array', async () => {
      await buildModule({ employees: [makeEmployee()] });

      // Mock dataSource to return empty teams for the manager query
      const originalQuery = service['dataSource'].query;
      jest
        .spyOn(service['dataSource'], 'query')
        .mockImplementation((sql: string) => {
          if (sql.includes('schema_provisioned')) {
            return Promise.resolve([{ schema_provisioned: false }]);
          }
          if (sql.includes('FROM teams')) {
            return Promise.resolve([]); // no managed teams
          }
          return originalQuery.call(service['dataSource'], sql);
        });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.MANAGER,
      );

      expect(result).toEqual([]);
    });
  });

  // ── response shape ────────────────────────────────────────────────────────

  describe('response shape', () => {
    it('groups multiple dates under a single member entry', async () => {
      // 2025-06-02=Mon(PRESENT), 2025-06-03=Tue(ON_LEAVE), 2025-06-04=Wed(ABSENT)
      await buildModule({
        employees: [makeEmployee()],
        leaves: [makeLeave('2025-06-03')],
        attendances: [makeAttendance('2025-06-02')],
      });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-02',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(USER_ID);
      expect(result[0].firstName).toBe(USER_FIRST);
      expect(result[0].lastName).toBe(USER_LAST);
      expect(result[0].dates).toHaveLength(3);
    });

    it('produces separate entries for different members', async () => {
      await buildModule({
        employees: [
          makeEmployee({
            user_id: 'user-A',
            first_name: 'Alice',
            last_name: 'A',
          }),
          makeEmployee({
            user_id: 'user-B',
            first_name: 'Bob',
            last_name: 'B',
          }),
        ],
      });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.userId).sort()).toEqual(['user-A', 'user-B']);
    });

    it('dates are returned in chronological order', async () => {
      await buildModule({
        employees: [makeEmployee()],
        attendances: [makeAttendance('2025-06-02')],
        leaves: [makeLeave('2025-06-03')],
      });

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-02',
        '2025-06-03',
        undefined,
        'UTC',
        USER_ID,
        UserRole.ADMIN,
      );

      const dates = result[0].dates.map((d) => d.date);
      expect(dates).toEqual(['2025-06-02', '2025-06-03']);
    });
  });
});

// ── Assertion helper ──────────────────────────────────────────────────────────

function expectSingleStatus(
  result: MemberCalendar[],
  date: string,
  status: string,
) {
  expect(result).toHaveLength(1);
  const entry = result[0].dates.find((d) => d.date === date);
  expect(entry).toBeDefined();
  expect(entry!.status).toBe(status);
}
