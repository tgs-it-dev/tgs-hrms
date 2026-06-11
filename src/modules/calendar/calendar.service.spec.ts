import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CalendarService, MemberCalendar } from './calendar.service';
import { CalendarCacheService } from './calendar-cache.service';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

// ── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-aaa';
const USER_ID = 'user-001';
const USER_FIRST = 'Jane';
const USER_LAST = 'Doe';

// day_of_week: 0=Sunday … 6=Saturday; 3=Wednesday (weekday)
const WEEKDAY = 3;
const SATURDAY = 6;
const SUNDAY = 0;

// ── Raw row factory ───────────────────────────────────────────────────────────

function makeRow(
  overrides: {
    date?: string;
    on_leave?: boolean;
    is_wfh?: boolean;
    has_attendance?: boolean;
    check_in_time?: string | null;
    day_of_week?: number;
  } = {},
) {
  return {
    user_id: USER_ID,
    first_name: USER_FIRST,
    last_name: USER_LAST,
    date: overrides.date ?? '2025-06-04',
    on_leave: overrides.on_leave ?? false,
    is_wfh: overrides.is_wfh ?? false,
    has_attendance: overrides.has_attendance ?? false,
    check_in_time: overrides.check_in_time ?? null,
    day_of_week: overrides.day_of_week ?? WEEKDAY,
  };
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeTenantDbService(rows: unknown[] = []) {
  return {
    withTenantSchemaReadOnly: jest
      .fn()
      .mockImplementation(
        async (
          _tenantId: string,
          cb: (em: { query: jest.Mock }) => Promise<unknown>,
        ) => {
          const em = { query: jest.fn().mockResolvedValue(rows) };
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

  async function buildModule(rows: unknown[] = []) {
    tenantDbService = makeTenantDbService(rows);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        CalendarCacheService,
        { provide: TenantDatabaseService, useValue: tenantDbService },
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, defaultValue: string) => defaultValue,
          },
        },
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
    it('returns the DB result on a cache miss and stores it', async () => {
      await buildModule([
        makeRow({
          has_attendance: true,
          check_in_time: '2025-06-04T07:00:00Z',
        }),
      ]);

      await service.getTeamCalendar(TENANT_ID, '2025-06-04', '2025-06-04');

      expect(tenantDbService.withTenantSchemaReadOnly).toHaveBeenCalledTimes(1);
    });

    it('serves cached result on a second call without hitting the DB', async () => {
      await buildModule([
        makeRow({
          has_attendance: true,
          check_in_time: '2025-06-04T07:00:00Z',
        }),
      ]);

      await service.getTeamCalendar(TENANT_ID, '2025-06-04', '2025-06-04');
      await service.getTeamCalendar(TENANT_ID, '2025-06-04', '2025-06-04');

      expect(tenantDbService.withTenantSchemaReadOnly).toHaveBeenCalledTimes(1);
    });

    it('re-queries after the 60 s TTL expires', async () => {
      await buildModule([
        makeRow({
          has_attendance: true,
          check_in_time: '2025-06-04T07:00:00Z',
        }),
      ]);

      await service.getTeamCalendar(TENANT_ID, '2025-06-04', '2025-06-04');
      jest.advanceTimersByTime(60_001);
      await service.getTeamCalendar(TENANT_ID, '2025-06-04', '2025-06-04');

      expect(tenantDbService.withTenantSchemaReadOnly).toHaveBeenCalledTimes(2);
    });

    it('treats different date ranges as separate cache entries', async () => {
      await buildModule([]);

      await service.getTeamCalendar(TENANT_ID, '2025-06-01', '2025-06-30');
      await service.getTeamCalendar(TENANT_ID, '2025-07-01', '2025-07-31');

      expect(tenantDbService.withTenantSchemaReadOnly).toHaveBeenCalledTimes(2);
    });

    it('invalidating the tenant clears the cache and forces a re-query', async () => {
      await buildModule([makeRow()]);

      await service.getTeamCalendar(TENANT_ID, '2025-06-04', '2025-06-04');
      cacheService.invalidate(TENANT_ID);
      await service.getTeamCalendar(TENANT_ID, '2025-06-04', '2025-06-04');

      expect(tenantDbService.withTenantSchemaReadOnly).toHaveBeenCalledTimes(2);
    });
  });

  // ── empty result ──────────────────────────────────────────────────────────

  describe('empty results', () => {
    it('returns an empty array when the DB returns no rows (no employees)', async () => {
      await buildModule([]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-01',
        '2025-06-30',
      );

      expect(result).toEqual([]);
    });

    it('returns member with empty dates array when every day is a weekend with no attendance', async () => {
      await buildModule([
        makeRow({ date: '2025-06-07', day_of_week: SATURDAY }), // weekend, no attendance
        makeRow({ date: '2025-06-08', day_of_week: SUNDAY }), // weekend, no attendance
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-07',
        '2025-06-08',
      );

      expect(result).toHaveLength(1);
      expect(result[0].dates).toHaveLength(0);
    });
  });

  // ── status priority: leave > WFH > attendance ─────────────────────────────

  describe('status derivation', () => {
    it('ON_LEAVE takes priority over WFH', async () => {
      await buildModule([
        makeRow({
          on_leave: true,
          is_wfh: true,
          has_attendance: true,
          check_in_time: '2025-06-04T07:00:00Z',
        }),
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
      );

      expectSingleStatus(result, '2025-06-04', 'ON_LEAVE');
    });

    it('ON_LEAVE takes priority even with no attendance', async () => {
      await buildModule([makeRow({ on_leave: true })]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
      );

      expectSingleStatus(result, '2025-06-04', 'ON_LEAVE');
    });

    it('WFH is returned when there is no leave', async () => {
      await buildModule([makeRow({ is_wfh: true })]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
      );

      expectSingleStatus(result, '2025-06-04', 'WFH');
    });

    it('PRESENT when check-in is before 9 AM local time', async () => {
      await buildModule([
        makeRow({
          has_attendance: true,
          check_in_time: '2025-06-04T06:00:00Z',
        }),
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
      );

      expectSingleStatus(result, '2025-06-04', 'PRESENT');
    });

    it('PRESENT when check-in is exactly at 9:00 AM — not WORK_LATE', async () => {
      // This is the key regression guard: >= was changed to >.
      // 9:00 AM UTC → hour = 9 → 9 > 9 is false → PRESENT.
      await buildModule([
        makeRow({
          has_attendance: true,
          check_in_time: '2025-06-04T09:00:00Z',
        }),
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
      );

      expectSingleStatus(result, '2025-06-04', 'PRESENT');
    });

    it('WORK_LATE when check-in hour is after 9 AM local time', async () => {
      // 10 AM UTC → hour = 10 → 10 > 9 → WORK_LATE
      await buildModule([
        makeRow({
          has_attendance: true,
          check_in_time: '2025-06-04T10:00:00Z',
        }),
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'UTC',
      );

      expectSingleStatus(result, '2025-06-04', 'WORK_LATE');
    });

    it('WORK_LATE is timezone-aware (9 AM PKT = 4 AM UTC)', async () => {
      // 04:01 UTC = 09:01 PKT → hour in PKT = 9 → 9 > 9 false → PRESENT
      // 05:00 UTC = 10:00 PKT → hour in PKT = 10 → 10 > 9 true → WORK_LATE
      await buildModule([
        makeRow({
          has_attendance: true,
          check_in_time: '2025-06-04T05:00:00Z',
        }),
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
        undefined,
        'Asia/Karachi',
      );

      expectSingleStatus(result, '2025-06-04', 'WORK_LATE');
    });

    it('ABSENT on a weekday with no attendance and no leave/WFH', async () => {
      await buildModule([makeRow({ day_of_week: WEEKDAY })]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
      );

      expectSingleStatus(result, '2025-06-04', 'ABSENT');
    });

    it('WEEKEND_WORK when an employee checks in on a Saturday', async () => {
      await buildModule([
        makeRow({
          date: '2025-06-07',
          day_of_week: SATURDAY,
          has_attendance: true,
          check_in_time: '2025-06-07T08:00:00Z',
        }),
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-07',
        '2025-06-07',
      );

      expectSingleStatus(result, '2025-06-07', 'WEEKEND_WORK');
    });

    it('weekend with no attendance is omitted from dates array', async () => {
      await buildModule([makeRow({ date: '2025-06-08', day_of_week: SUNDAY })]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-08',
        '2025-06-08',
      );

      expect(result).toHaveLength(1);
      expect(result[0].dates).toHaveLength(0);
    });

    it('PRESENT when has_attendance is true but check_in_time is null (data anomaly guard)', async () => {
      await buildModule([
        makeRow({ has_attendance: true, check_in_time: null }),
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
      );

      expectSingleStatus(result, '2025-06-04', 'PRESENT');
    });
  });

  // ── response shape ────────────────────────────────────────────────────────

  describe('response shape', () => {
    it('groups multiple dates under a single member entry', async () => {
      await buildModule([
        makeRow({
          date: '2025-06-02',
          has_attendance: true,
          check_in_time: '2025-06-02T07:00:00Z',
        }),
        makeRow({ date: '2025-06-03', on_leave: true }),
        makeRow({ date: '2025-06-04' }), // ABSENT weekday
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-02',
        '2025-06-04',
      );

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(USER_ID);
      expect(result[0].firstName).toBe(USER_FIRST);
      expect(result[0].lastName).toBe(USER_LAST);
      expect(result[0].dates).toHaveLength(3);
    });

    it('produces separate entries for different members', async () => {
      await buildModule([
        {
          ...makeRow(),
          user_id: 'user-A',
          first_name: 'Alice',
          last_name: 'A',
        },
        { ...makeRow(), user_id: 'user-B', first_name: 'Bob', last_name: 'B' },
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-04',
        '2025-06-04',
      );

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.userId).sort()).toEqual(['user-A', 'user-B']);
    });

    it('dates are returned in chronological order (DB order preserved)', async () => {
      await buildModule([
        makeRow({
          date: '2025-06-02',
          has_attendance: true,
          check_in_time: '2025-06-02T07:00:00Z',
        }),
        makeRow({ date: '2025-06-03', on_leave: true }),
      ]);

      const result = await service.getTeamCalendar(
        TENANT_ID,
        '2025-06-02',
        '2025-06-03',
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
