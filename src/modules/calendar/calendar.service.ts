import { Injectable } from '@nestjs/common';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { CalendarCacheService } from './calendar-cache.service';
import { isValidTimezone } from '../../common/utils/date.util';

export type CalendarStatus =
  | 'WFH'
  | 'ON_LEAVE'
  | 'PRESENT'
  | 'ABSENT'
  | 'WORK_LATE'
  | 'WEEKEND_WORK';

export interface DateStatusEntry {
  readonly date: string;
  readonly status: CalendarStatus;
}

export interface MemberCalendar {
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly dates: DateStatusEntry[];
}

interface RawCalendarRow {
  user_id: string;
  first_name: string;
  last_name: string;
  date: string; // to_char guarantees YYYY-MM-DD text — never a JS Date
  on_leave: boolean;
  is_wfh: boolean;
  has_attendance: boolean;
  check_in_time: Date | string | null;
  day_of_week: number;
}

// Check-ins at or after this local hour are flagged WORK_LATE (9 AM in the request timezone).
const WORK_START_HOUR_LOCAL = 9;

const DEFAULT_TZ = 'UTC';

@Injectable()
export class CalendarService {
  constructor(
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

    const rows = await this.runQuery(tenantId, from, to, teamId, timezone);
    const result = this.buildResponse(rows, timezone);

    this.cacheService.set(cacheKey, result);
    return result;
  }

  private async runQuery(
    tenantId: string,
    from: string,
    to: string,
    teamId: string | undefined,
    timezone: string,
  ): Promise<RawCalendarRow[]> {
    const sql = this.buildSql(!!teamId);
    const params: unknown[] = [from, to, tenantId];
    if (teamId) params.push(teamId);
    params.push(timezone); // always last

    // Always route through withTenantSchemaReadOnly so the connection's
    // search_path is set to "<tenant_schema>", public before execution.
    //
    // PostgreSQL silently ignores schemas that don't exist in the path, so
    // this is safe for both provisioned tenants (tenant schema used) and
    // non-provisioned tenants (falls through to public automatically).
    // The alternative — running directly on the public DataSource — is what
    // was causing ABSENT for all users whose data lives in a tenant schema.
    return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
      em.query<RawCalendarRow[]>(sql, params),
    );
  }

  private buildSql(hasTeamFilter: boolean): string {
    // Timezone is always the last positional param.
    // Without teamId: $1=from $2=to $3=tenantId $4=timezone
    // With    teamId: $1=from $2=to $3=tenantId $4=teamId $5=timezone
    const tzParam = hasTeamFilter ? '$5' : '$4';

    return `
      SELECT
        u.id                                               AS user_id,
        u.first_name,
        u.last_name,
        to_char(ds.date, 'YYYY-MM-DD')                    AS date,
        BOOL_OR(l."employeeId" IS NOT NULL)               AS on_leave,
        BOOL_OR(w.employee_id IS NOT NULL)                AS is_wfh,
        BOOL_OR(a.user_id IS NOT NULL)                    AS has_attendance,
        MIN(a.check_in_time)                              AS check_in_time,
        EXTRACT(DOW FROM ds.date)::int                    AS day_of_week
      FROM generate_series($1::date, $2::date, '1 day'::interval) AS ds(date)
      CROSS JOIN employees emp
      JOIN users u
        ON u.id = emp.user_id
        AND u.tenant_id = $3
      LEFT JOIN leaves l
        ON l."employeeId" = u.id
        AND l."tenantId" = $3
        AND l.status IN ('approved', 'processing')
        AND ds.date::date BETWEEN l."startDate"::date AND l."endDate"::date
      LEFT JOIN wfh_requests w
        ON w.employee_id = u.id
        AND w.tenant_id = $3
        AND w.status = 'approved'
        AND ds.date::date BETWEEN w.start_date::date AND w.end_date::date
      LEFT JOIN (
        SELECT
          a2.user_id,
          (a2.timestamp AT TIME ZONE ${tzParam})::date   AS att_date,
          MIN(a2.timestamp)                               AS check_in_time
        FROM attendance a2
        WHERE a2.type = 'check-in'
          AND (a2.timestamp AT TIME ZONE ${tzParam})::date
              BETWEEN $1::date AND $2::date
        GROUP BY a2.user_id, (a2.timestamp AT TIME ZONE ${tzParam})::date
      ) a ON a.user_id = u.id AND a.att_date = ds.date::date
      WHERE emp.deleted_at IS NULL
        AND emp.status != 'terminated'
        ${hasTeamFilter ? 'AND emp.team_id = $4' : ''}
      GROUP BY u.id, u.first_name, u.last_name, ds.date
      ORDER BY u.first_name, u.last_name, ds.date
    `;
  }

  private buildResponse(
    rows: RawCalendarRow[],
    timezone: string,
  ): MemberCalendar[] {
    const memberMap = new Map<string, MemberCalendar>();

    for (const row of rows) {
      if (!memberMap.has(row.user_id)) {
        memberMap.set(row.user_id, {
          userId: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          dates: [],
        });
      }

      const status = this.deriveStatus(row, timezone);
      if (status !== null) {
        memberMap.get(row.user_id)!.dates.push({
          date: String(row.date),
          status,
        });
      }
    }

    return Array.from(memberMap.values());
  }

  private deriveStatus(
    row: RawCalendarRow,
    timezone: string,
  ): CalendarStatus | null {
    const dow = Number(row.day_of_week);
    const isWeekend = dow === 0 || dow === 6;

    if (row.on_leave) return 'ON_LEAVE';
    if (row.is_wfh) return 'WFH';

    if (isWeekend) {
      return row.has_attendance ? 'WEEKEND_WORK' : null;
    }

    if (row.has_attendance) {
      const checkInHour = row.check_in_time
        ? this.getLocalHour(row.check_in_time, timezone)
        : 0;
      return checkInHour >= WORK_START_HOUR_LOCAL ? 'WORK_LATE' : 'PRESENT';
    }

    return 'ABSENT';
  }

  /**
   * Returns the clock hour (0–23) for a timestamp in the given IANA timezone.
   * Handles the Intl midnight edge case where hour 24 means 0.
   */
  private getLocalHour(timestamp: Date | string, timezone: string): number {
    const date =
      typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const formatted = new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).format(date);
    const hour = parseInt(formatted, 10);
    return hour === 24 ? 0 : hour;
  }
}
