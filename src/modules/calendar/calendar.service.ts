import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { CalendarCacheService } from './calendar-cache.service';
import { isValidTimezone } from '../../common/utils/date.util';

export type CalendarStatus =
  | 'WFH'
  | 'ON_LEAVE'
  | 'PRESENT'
  | 'ABSENT'
  | 'WEEKEND_WORK';

export interface DateStatusEntry {
  readonly date: string;
  readonly status: CalendarStatus;
}

export interface MemberCalendar {
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly dates: ReadonlyArray<DateStatusEntry>;
}

// ── Raw row types (one per query) ─────────────────────────────────────────────

interface RawEmployee {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface RawLeave {
  employeeId: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

interface RawWfh {
  employee_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

interface RawAttendance {
  user_id: string;
  att_date: string; // YYYY-MM-DD (shifted to request timezone)
}

const DEFAULT_TZ = 'UTC';

// ── SQL ───────────────────────────────────────────────────────────────────────
// Provisioned tenants: employees/leaves/wfh_requests/attendance live in the
// tenant schema (set via search_path). users always lives in public.
// Non-provisioned tenants: all tables are in public; u.tenant_id = $1 is the
// only scope boundary — employees has no tenant_id column of its own.

// $1=tenantId  [$2=teamId when hasTeam is true]
function employeesSql(hasTeam: boolean): string {
  return `
    SELECT e.user_id, u.first_name, u.last_name
    FROM   employees e
    INNER  JOIN users u ON u.id = e.user_id AND u.tenant_id = $1
    WHERE  e.deleted_at IS NULL
      AND  e.status != 'terminated'
      ${hasTeam ? 'AND e.team_id = $2' : ''}
    ORDER  BY u.first_name, u.last_name
  `;
}

// $1=userIds[]  $2=from (YYYY-MM-DD)  $3=to (YYYY-MM-DD)
// Finds every approved/processing leave that overlaps [from, to].
// leaves.employeeId stores users.id (FK to public.users, not employees.id).
// Explicit ::uuid[] cast ensures ANY() works when pg driver sends a text[].
const LEAVES_SQL = `
  SELECT l."employeeId",
         to_char(l."startDate", 'YYYY-MM-DD') AS start_date,
         to_char(l."endDate", 'YYYY-MM-DD') AS end_date
  FROM leaves l
  WHERE l."employeeId" = ANY($1::uuid[])
    AND l."status" IN ('approved')
    AND l."startDate" <= $3::date
    AND l."endDate" >= $2::date
    `;

// $1=userIds[]  $2=from (YYYY-MM-DD)  $3=to (YYYY-MM-DD)
const WFH_SQL = `
  SELECT w.employee_id,
         to_char(w.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(w.end_date,   'YYYY-MM-DD') AS end_date
  FROM   wfh_requests w
  WHERE  w.employee_id = ANY($1::uuid[])
    AND  w.status = 'approved'
    AND  w.start_date <= $3::date
    AND  w.end_date   >= $2::date
`;

// $1=userIds[]  $2=from (YYYY-MM-DD)  $3=to (YYYY-MM-DD)  $4=IANA timezone
// attendance."timestamp" is timestamptz (stored in UTC).
// AT TIME ZONE converts UTC → local time so ::date gives the correct local date.
// The column is quoted as "timestamp" because it shares a name with a PostgreSQL
// type keyword — without a table alias or quotes the parser can misinterpret it.
const ATTENDANCE_SQL = `
  SELECT DISTINCT
         att.user_id,
         to_char((att."timestamp" AT TIME ZONE $4)::date, 'YYYY-MM-DD') AS att_date
  FROM   attendance att
  WHERE  att.user_id = ANY($1::uuid[])
    AND  att.type = 'check-in'
    AND  (att."timestamp" AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
`;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CalendarService {
  // NOTE: This cache is process-local (in-memory Map). In a single-instance
  // deployment this is fine. For horizontally-scaled deployments replace with
  // a shared Redis cache — local invalidation does not propagate to other pods.
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly tenantDbService: TenantDatabaseService,
    private readonly cacheService: CalendarCacheService,
  ) {}

  resolveTimezone(tz?: string, headerTz?: string): string {
    for (const candidate of [tz, headerTz]) {
      if (candidate && isValidTimezone(candidate)) return candidate;
    }
    return DEFAULT_TZ;
  }

  async getTeamCalendar(
    tenantId: string,
    from: string,
    to: string,
    teamId?: string,
    timezone: string = DEFAULT_TZ,
  ): Promise<MemberCalendar[]> {
    const cacheKey = this.cacheService.buildKey(
      tenantId,
      from,
      to,
      teamId,
      timezone,
    );
    const cached = this.cacheService.get<MemberCalendar[]>(cacheKey);
    if (cached) return cached;

    const result = await this.fetchAndBuild(
      tenantId,
      from,
      to,
      teamId,
      timezone,
    );
    this.cacheService.set(cacheKey, result);
    return result;
  }

  private async fetchAndBuild(
    tenantId: string,
    from: string,
    to: string,
    teamId: string | undefined,
    timezone: string,
  ): Promise<MemberCalendar[]> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    // Routes a query through the tenant schema (provisioned) or public schema (shared).
    const run = <T>(sql: string, params: unknown[]): Promise<T[]> =>
      isProvisioned
        ? this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
            em.query<T[]>(sql, params),
          )
        : this.dataSource.query<T[]>(sql, params);

    // Step 1 — employees (sequential: userIds are needed for step 2)
    const empParams: unknown[] = [tenantId];
    if (teamId) empParams.push(teamId);
    const employees = await run<RawEmployee>(employeesSql(!!teamId), empParams);

    if (employees.length === 0) return [];

    const userIds = employees.map((e) => e.user_id);

    // Step 2 — leaves, WFH, attendance in parallel (no interdependencies)
    const [leaves, wfhs, attendances] = await Promise.all([
      run<RawLeave>(LEAVES_SQL, [userIds, from, to]),
      run<RawWfh>(WFH_SQL, [userIds, from, to]),
      run<RawAttendance>(ATTENDANCE_SQL, [userIds, from, to, timezone]),
    ]);

    return buildResult(employees, leaves, wfhs, attendances, from, to);
  }

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<
      { schema_provisioned: boolean }[]
    >(`SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`, [
      tenantId,
    ]);
    return result[0]?.schema_provisioned ?? false;
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function buildResult(
  employees: RawEmployee[],
  leaves: RawLeave[],
  wfhs: RawWfh[],
  attendances: RawAttendance[],
  from: string,
  to: string,
): MemberCalendar[] {
  const leavesByUser = groupBy(leaves, 'employeeId');
  const wfhsByUser = groupBy(wfhs, 'employee_id');
  const attendedSet = new Set(
    attendances.map((a) => `${a.user_id}:${a.att_date}`),
  );
  const dates = generateDateSeries(from, to);

  return employees.map((emp) => {
    const empLeaves = leavesByUser.get(emp.user_id) ?? [];
    const empWfhs = wfhsByUser.get(emp.user_id) ?? [];

    const dateEntries: DateStatusEntry[] = [];
    for (const date of dates) {
      const status = deriveStatus(
        date,
        empLeaves,
        empWfhs,
        attendedSet.has(`${emp.user_id}:${date}`),
      );
      if (status !== null) {
        dateEntries.push({ date, status });
      }
    }

    return {
      userId: emp.user_id,
      firstName: emp.first_name,
      lastName: emp.last_name,
      dates: dateEntries,
    };
  });
}

function deriveStatus(
  date: string,
  leaves: RawLeave[],
  wfhs: RawWfh[],
  hasAttendance: boolean,
): CalendarStatus | null {
  // Noon UTC avoids DST-induced day shifts when constructing a Date from a bare date string.
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  const isWeekend = dow === 0 || dow === 6;

  // YYYY-MM-DD lexicographic order equals chronological order.
  if (leaves.some((l) => l.start_date <= date && date <= l.end_date))
    return 'ON_LEAVE';
  if (wfhs.some((w) => w.start_date <= date && date <= w.end_date))
    return 'WFH';
  if (isWeekend) return hasAttendance ? 'WEEKEND_WORK' : null;
  return hasAttendance ? 'PRESENT' : 'ABSENT';
}

function generateDateSeries(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function groupBy<T>(rows: T[], key: keyof T & string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = String(row[key]);
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}
