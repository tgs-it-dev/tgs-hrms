import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, Between, In, DataSource } from 'typeorm';
import { Attendance } from '../../entities/attendance.entity';
import {
  AttendanceType,
  EmployeeStatus,
  UserRole,
  LeaveStatus,
} from '../../common/constants/enums';
import { Leave } from '../../entities/leave.entity';
import { User } from '../../entities/user.entity';
import { Employee } from '../../entities/employee.entity';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { buildFixedCsv } from '../../common/utils/csv.util';

/** Default office start time in PKT (UTC+5) used for late detection. */
const OFFICE_START_HOUR_PKT = 9;
/** Offset in ms to convert UTC timestamps to PKT (UTC+5). */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly tenantDbService: TenantDatabaseService,
  ) {}

  // ── Shared helpers ────────────────────────────────────────────────────────

  private defaultDateRange(
    from?: string,
    to?: string,
  ): { start: Date; end: Date } {
    const now = new Date();
    const start = from
      ? new Date(`${from}T00:00:00.000Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = to
      ? new Date(`${to}T23:59:59.999Z`)
      : new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          ),
        );
    return { start, end };
  }

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<
      { schema_provisioned: boolean }[]
    >(`SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`, [
      tenantId,
    ]);
    return result[0]?.schema_provisioned ?? false;
  }

  // ── Attendance CSV ────────────────────────────────────────────────────────

  async getAttendanceCsv(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<string> {
    const headers = [
      'employee_name',
      'date',
      'clock_in',
      'clock_out',
      'total_hours',
      'is_late',
      'late_by_mins',
    ] as const;

    const { start, end } = this.defaultDateRange(from, to);
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const fetchRecords = (repo: Repository<Attendance>) =>
      repo
        .createQueryBuilder('att')
        .leftJoinAndSelect('att.user', 'user')
        .where('user.tenant_id = :tenantId', { tenantId })
        .andWhere('att.timestamp >= :start', { start })
        .andWhere('att.timestamp <= :end', { end })
        .orderBy('att.timestamp', 'ASC')
        .getMany();

    const records = isProvisioned
      ? await this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
          fetchRecords(em.getRepository(Attendance)),
        )
      : await fetchRecords(this.attendanceRepo);

    // Group by user_id + PKT date; track earliest check-in and latest check-out
    const grouped = new Map<
      string,
      { user: User; checkIn?: Date; checkOut?: Date }
    >();

    for (const rec of records) {
      const pkDate = new Date(rec.timestamp.getTime() + PKT_OFFSET_MS);
      const dateStr = pkDate.toISOString().slice(0, 10);
      const key = `${rec.user_id}::${dateStr}`;

      if (!grouped.has(key)) grouped.set(key, { user: rec.user });
      const entry = grouped.get(key)!;

      if (rec.type === AttendanceType.CHECK_IN) {
        if (!entry.checkIn || rec.timestamp < entry.checkIn)
          entry.checkIn = rec.timestamp;
      } else {
        if (!entry.checkOut || rec.timestamp > entry.checkOut)
          entry.checkOut = rec.timestamp;
      }
    }

    const rows: string[][] = [];

    for (const [key, entry] of grouped) {
      const dateStr = key.split('::')[1];
      const employeeName =
        `${entry.user?.first_name ?? ''} ${entry.user?.last_name ?? ''}`.trim();

      let clockIn = '';
      let clockOut = '';
      let totalHours = '';
      let isLate = 'false';
      let lateByMins = '0';

      if (entry.checkIn) {
        const pkCheckIn = new Date(entry.checkIn.getTime() + PKT_OFFSET_MS);
        clockIn = pkCheckIn.toISOString().replace('T', ' ').slice(0, 19);

        const minuteOfDay =
          pkCheckIn.getUTCHours() * 60 + pkCheckIn.getUTCMinutes();
        const late = minuteOfDay - OFFICE_START_HOUR_PKT * 60;
        isLate = late > 0 ? 'true' : 'false';
        lateByMins = late > 0 ? String(late) : '0';
      }

      if (entry.checkOut) {
        const pkCheckOut = new Date(entry.checkOut.getTime() + PKT_OFFSET_MS);
        clockOut = pkCheckOut.toISOString().replace('T', ' ').slice(0, 19);
      }

      if (entry.checkIn && entry.checkOut) {
        const hours =
          (entry.checkOut.getTime() - entry.checkIn.getTime()) /
          (1000 * 60 * 60);
        totalHours = hours.toFixed(2);
      }

      rows.push([
        employeeName,
        dateStr,
        clockIn,
        clockOut,
        totalHours,
        isLate,
        lateByMins,
      ]);
    }

    rows.sort((a, b) => {
      const nameComp = (a[0] ?? '').localeCompare(b[0] ?? '');
      return nameComp !== 0 ? nameComp : (a[1] ?? '').localeCompare(b[1] ?? '');
    });

    return buildFixedCsv(headers, rows);
  }

  // ── Leave CSV ─────────────────────────────────────────────────────────────

  async getLeaveCsv(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<string> {
    const headers = [
      'employee_name',
      'leave_type',
      'start_date',
      'end_date',
      'days',
      'status',
      'approved_by',
    ] as const;

    const { start, end } = this.defaultDateRange(from, to);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const fetchLeaves = (repo: Repository<Leave>) =>
      repo
        .createQueryBuilder('leave')
        .leftJoinAndSelect('leave.employee', 'employee')
        .leftJoinAndSelect('leave.leaveType', 'leaveType')
        .leftJoinAndSelect('leave.approver', 'approver')
        .where('leave.tenantId = :tenantId', { tenantId })
        .andWhere('leave.startDate >= :startStr', { startStr })
        .andWhere('leave.startDate <= :endStr', { endStr })
        .orderBy('leave.startDate', 'ASC')
        .getMany();

    const leaves = isProvisioned
      ? await this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
          fetchLeaves(em.getRepository(Leave)),
        )
      : await fetchLeaves(this.leaveRepo);

    const rows: string[][] = leaves.map((leave) => {
      const employeeName =
        `${leave.employee?.first_name ?? ''} ${leave.employee?.last_name ?? ''}`.trim();
      const approvedBy = leave.approver
        ? `${leave.approver.first_name ?? ''} ${leave.approver.last_name ?? ''}`.trim()
        : '';

      return [
        employeeName,
        leave.leaveType?.name ?? '',
        String(leave.startDate),
        String(leave.endDate),
        String(leave.totalDays),
        leave.status,
        approvedBy,
      ];
    });

    return buildFixedCsv(headers, rows);
  }

  // ── Flex-Requests CSV ─────────────────────────────────────────────────────

  async getFlexRequestsCsv(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<string> {
    const headers = [
      'employee_name',
      'request_type',
      'date',
      'status',
      'approved_by',
    ] as const;

    const { start, end } = this.defaultDateRange(from, to);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    type FlexRow = {
      employee_name: string;
      request_type: string;
      date: string;
      status: string;
      approved_by: string;
    };

    const fetchRows = async (
      runQuery: (sql: string, params: unknown[]) => Promise<FlexRow[]>,
    ): Promise<FlexRow[]> => {
      const wfhSql = `
        SELECT
          u.first_name || ' ' || u.last_name AS employee_name,
          'WFH' AS request_type,
          w.start_date::text AS date,
          w.status,
          COALESCE(au.first_name || ' ' || au.last_name, '') AS approved_by
        FROM wfh_requests w
        JOIN users u ON u.id = w.employee_id
        LEFT JOIN workflow_requests wr ON wr.related_entity_id = w.id
          AND wr.request_type = 'wfh'
        LEFT JOIN workflow_steps ws ON ws.workflow_request_id = wr.id
          AND ws.status = 'approved'
        LEFT JOIN users au ON au.id = ws.approver_id
        WHERE w.tenant_id = $1
          AND w.start_date >= $2
          AND w.start_date <= $3
        ORDER BY w.start_date ASC
      `;

      const overtimeSql = `
        SELECT
          u.first_name || ' ' || u.last_name AS employee_name,
          'Overtime' AS request_type,
          o.start_date::text AS date,
          o.status,
          COALESCE(au.first_name || ' ' || au.last_name, '') AS approved_by
        FROM overtime_requests o
        JOIN users u ON u.id = o.employee_id
        LEFT JOIN workflow_requests wr ON wr.related_entity_id = o.id
          AND wr.request_type = 'overtime'
        LEFT JOIN workflow_steps ws ON ws.workflow_request_id = wr.id
          AND ws.status = 'approved'
        LEFT JOIN users au ON au.id = ws.approver_id
        WHERE o.tenant_id = $1
          AND o.start_date >= $2
          AND o.start_date <= $3
        ORDER BY o.start_date ASC
      `;

      const params = [tenantId, startStr, endStr];
      const [wfhRows, overtimeRows] = await Promise.all([
        runQuery(wfhSql, params),
        runQuery(overtimeSql, params),
      ]);

      return [...wfhRows, ...overtimeRows].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    };

    let flexRows: FlexRow[];

    if (isProvisioned) {
      flexRows = await this.tenantDbService.withTenantSchema(tenantId, (em) =>
        fetchRows((sql, params) => em.query<FlexRow[]>(sql, params)),
      );
    } else {
      flexRows = await fetchRows((sql, params) =>
        this.dataSource.query<FlexRow[]>(sql, params),
      );
    }

    const rows = flexRows.map((r) => [
      r.employee_name,
      r.request_type,
      r.date,
      r.status,
      r.approved_by,
    ]);

    return buildFixedCsv(headers, rows);
  }

  async getAttendanceSummary(userId?: string, month?: string) {
    // Parse month (format: YYYY-MM)
    const now = new Date();
    let year = now.getFullYear();
    let monthIdx = now.getMonth(); // 0-based
    if (month) {
      const parts = month.split('-').map(Number);
      const y = parts[0];
      const m = parts[1];
      if (y !== undefined && m !== undefined && !isNaN(y) && !isNaN(m)) {
        year = y;
        monthIdx = m - 1;
      }
    }
    const startOfMonth = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0));
    const endOfMonth = new Date(
      Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999),
    );

    // Get all users if userId not provided
    let userIds: string[] = [];
    if (userId) {
      userIds = [userId];
    } else {
      const users = await this.userRepo.find();
      userIds = users.map((u) => u.id);
    }

    // Prepare result
    const result: Record<string, any> = {};
    for (const uid of userIds) {
      // Get all check-ins for the user in the month
      const attendances = await this.attendanceRepo.find({
        where: {
          user_id: uid,
          timestamp: Between(startOfMonth, endOfMonth),
          type: AttendanceType.CHECK_IN,
        },
        order: { timestamp: 'ASC' },
      });
      // Group by date (Pakistan time)
      const days: Record<string, Attendance[]> = {};
      for (const att of attendances) {
        // Convert UTC to Pakistan time (UTC+5)
        const pkDate = new Date(att.timestamp.getTime() + 5 * 60 * 60 * 1000);
        const dateStr = pkDate.toISOString().split('T')[0];
        if (!dateStr) continue;
        if (!days[dateStr]) days[dateStr] = [];
        days[dateStr].push(att);
      }
      let totalDaysWorked = 0;
      // For each day, count as worked
      for (const _ of Object.entries(days)) {
        totalDaysWorked++;
      }
      result[uid] = {
        totalDaysWorked,
      };
    }
    return result;
  }

  // New: N-day attendance summary by tenant for all active employees
  async getAttendanceSummaryLastDays(
    tenantId: string,
    days: number,
    page: number = 1,
  ) {
    if (!tenantId) {
      return { items: [], total: 0, page: 1, limit: 25, totalPages: 0 };
    }
    if (!Number.isFinite(days) || days <= 0 || days > 366) {
      throw new BadRequestException('Invalid days');
    }

    // Calculate date range: 30 days of previous month + current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Start from 30 days before current month
    const startDate = new Date(currentYear, currentMonth - 1, 1); // First day of previous month
    const endDate = new Date(); // Current date

    const limit = 25;
    const skip = (page - 1) * limit;

    // First get total count for pagination
    const totalQuery = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('employee.deleted_at IS NULL')
      .andWhere('employee.status = :status', { status: EmployeeStatus.ACTIVE });

    const total = await totalQuery.getCount();

    // Fetch active employees in tenant with user/designation/department info
    const employees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('employee.deleted_at IS NULL')
      .andWhere('employee.status = :status', { status: EmployeeStatus.ACTIVE })
      .orderBy('user.first_name', 'ASC')
      .addOrderBy('user.last_name', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();

    if (!employees.length) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const userIds = employees.map((e) => e.user_id);

    // Attendance: count distinct days with at least one check-in per user within range
    const rawAttendance = (await this.attendanceRepo
      .createQueryBuilder('attendance')
      .select('attendance.user_id', 'user_id')
      .addSelect(
        "TO_CHAR((attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date, 'YYYY-MM-DD')",
        'day',
      )
      .where('attendance.user_id IN (:...userIds)', { userIds })
      .andWhere('attendance.type = :type', { type: AttendanceType.CHECK_IN })
      .andWhere('attendance.timestamp BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .groupBy('attendance.user_id')
      .addGroupBy(
        "(attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date",
      )
      .getRawMany()) as unknown as Array<{ user_id: string; day: string }>;

    const workedDaysByUser: Record<string, Set<string>> = {};
    for (const row of rawAttendance) {
      const uid = row.user_id;
      const day = row.day;
      if (!workedDaysByUser[uid]) workedDaysByUser[uid] = new Set<string>();
      workedDaysByUser[uid].add(day);
    }

    // Leaves: sum approved leave days in range (inclusive) by user
    const approvedLeaves = await this.leaveRepo.find({
      where: {
        employeeId: In(userIds),
        status: LeaveStatus.APPROVED,
        startDate: Between(startDate as any, endDate as any),
      },
    });

    // Separate informed leaves from other leaves
    const informedLeaveDaysByUser: Record<string, number> = {};
    const otherLeaveDaysByUser: Record<string, number> = {};

    for (const lv of approvedLeaves) {
      const from = new Date(lv.startDate);
      const to = new Date(lv.endDate || lv.startDate);
      // clamp to range
      const s = from < startDate ? startDate : from;
      const e = to > endDate ? endDate : to;
      let count = 0;
      // count business days only (Mon-Fri)
      const dayMs = 24 * 60 * 60 * 1000;
      for (
        let d = new Date(
          Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()),
        );
        d <=
        new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
        d = new Date(d.getTime() + dayMs)
      ) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) count++;
      }

      // Check if it's an informed leave (you can modify this logic based on your business rules)
      // For now, assuming all approved leaves are "informed leaves"
      informedLeaveDaysByUser[lv.employeeId] =
        (informedLeaveDaysByUser[lv.employeeId] || 0) + count;
    }

    // Helper to compute business days (Mon-Fri) between two dates, inclusive
    const computeBusinessDays = (start: Date, end: Date): number => {
      let count = 0;
      const dayMs = 24 * 60 * 60 * 1000;
      const s = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate(),
        ),
      );
      const e = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
      );
      for (let d = s; d <= e; d = new Date(d.getTime() + dayMs)) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) count++;
      }
      return count;
    };

    // Build response (respect employee joining date)
    const items = employees.map((emp) => {
      const uid = emp.user_id;
      const workedDays = workedDaysByUser[uid]?.size || 0;
      const informedLeaves = informedLeaveDaysByUser[uid] || 0;
      const otherLeaves = otherLeaveDaysByUser[uid] || 0;
      const totalLeaves = informedLeaves + otherLeaves;

      // Start counting working days from the later of global startDate or employee joining date
      const employeeStartDate =
        emp.created_at && emp.created_at > startDate
          ? emp.created_at
          : startDate;
      const businessDaysInRangeForEmployee = computeBusinessDays(
        employeeStartDate,
        endDate,
      );

      // Absents are days with no check-in (excluding weekends)
      const absentDays = Math.max(
        businessDaysInRangeForEmployee - workedDays - totalLeaves,
        0,
      );

      return {
        employeeName:
          `${emp.user?.first_name || ''} ${emp.user?.last_name || ''}`.trim(),
        workingDays: businessDaysInRangeForEmployee, // Total working days in the period (from joining date)
        presents: workedDays, // Days with check-in
        absents: absentDays, // Days with no check-in (excluding weekends)
        informedLeaves: informedLeaves, // Informed leave days
        department: emp.designation?.department?.name || null,
        designation: emp.designation?.title || null,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // Returns attendance summary split by previous month and current month
  async getAttendanceSummarySplitByMonth(tenantId: string, page: number = 1) {
    if (!tenantId) {
      return { previousMonthSummary: [], currentMonthSummary: [] };
    }
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Previous month range
    const prevMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthEnd = new Date(
      currentYear,
      currentMonth,
      0,
      23,
      59,
      59,
      999,
    ); // last day of previous month
    // Current month range
    const currMonthStart = new Date(currentYear, currentMonth, 1);
    const currMonthEnd = now;

    const limit = 25;
    const skip = (page - 1) * limit;

    // Get employees
    const employees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('employee.deleted_at IS NULL')
      .andWhere('employee.status = :status', { status: EmployeeStatus.ACTIVE })
      .orderBy('user.first_name', 'ASC')
      .addOrderBy('user.last_name', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();
    if (!employees.length) {
      return { previousMonthSummary: [], currentMonthSummary: [] };
    }
    const userIds = employees.map((e) => e.user_id);

    // Helper to get summary for a given range
    const getSummary = async (startDate: Date, endDate: Date) => {
      // Attendance
      const rawAttendance = (await this.attendanceRepo
        .createQueryBuilder('attendance')
        .select('attendance.user_id', 'user_id')
        .addSelect(
          "TO_CHAR((attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date, 'YYYY-MM-DD')",
          'day',
        )
        .where('attendance.user_id IN (:...userIds)', { userIds })
        .andWhere('attendance.type = :type', { type: AttendanceType.CHECK_IN })
        .andWhere('attendance.timestamp BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .groupBy('attendance.user_id')
        .addGroupBy(
          "(attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date",
        )
        .getRawMany()) as unknown as Array<{ user_id: string; day: string }>;
      const workedDaysByUser: Record<string, Set<string>> = {};
      for (const row of rawAttendance) {
        const uid = row.user_id;
        const day = row.day;
        if (!workedDaysByUser[uid]) workedDaysByUser[uid] = new Set<string>();
        workedDaysByUser[uid].add(day);
      }
      // Leaves
      const approvedLeaves = await this.leaveRepo.find({
        where: {
          employeeId: In(userIds),
          status: LeaveStatus.APPROVED,
          startDate: Between(startDate as any, endDate as any),
        },
      });
      const informedLeaveDaysByUser: Record<string, number> = {};
      for (const lv of approvedLeaves) {
        const from = new Date(lv.startDate);
        const to = new Date(lv.endDate || lv.startDate);
        const s = from < startDate ? startDate : from;
        const e = to > endDate ? endDate : to;
        let count = 0;
        const dayMs = 24 * 60 * 60 * 1000;
        for (
          let d = new Date(
            Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()),
          );
          d <=
          new Date(
            Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()),
          );
          d = new Date(d.getTime() + dayMs)
        ) {
          const dow = d.getUTCDay();
          if (dow !== 0 && dow !== 6) count++;
        }
        informedLeaveDaysByUser[lv.employeeId] =
          (informedLeaveDaysByUser[lv.employeeId] || 0) + count;
      }
      // Helper to compute business days (Mon-Fri) between two dates, inclusive
      const computeBusinessDays = (start: Date, end: Date): number => {
        let count = 0;
        const dayMs = 24 * 60 * 60 * 1000;
        const s = new Date(
          Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth(),
            start.getUTCDate(),
          ),
        );
        const e = new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
        );
        for (let d = s; d <= e; d = new Date(d.getTime() + dayMs)) {
          const dow = d.getUTCDay();
          if (dow !== 0 && dow !== 6) count++;
        }
        return count;
      };

      // Build response (respect employee joining date)
      return employees.map((emp) => {
        const uid = emp.user_id;
        const presents = workedDaysByUser[uid]?.size || 0;
        const informedLeaves = informedLeaveDaysByUser[uid] || 0;

        // Start counting working days from the later of range startDate or employee joining date
        const employeeStartDate =
          emp.created_at && emp.created_at > startDate
            ? emp.created_at
            : startDate;
        const businessDaysInRangeForEmployee = computeBusinessDays(
          employeeStartDate,
          endDate,
        );

        const absents = Math.max(
          businessDaysInRangeForEmployee - presents - informedLeaves,
          0,
        );
        return {
          employeeName:
            `${emp.user?.first_name || ''} ${emp.user?.last_name || ''}`.trim(),
          workingDays: businessDaysInRangeForEmployee,
          presents,
          absents,
          informedLeaves,
          department: emp.designation?.department?.name || null,
          designation: emp.designation?.title || null,
        };
      });
    };
    const previousMonthSummary = await getSummary(prevMonthStart, prevMonthEnd);
    const currentMonthSummary = await getSummary(currMonthStart, currMonthEnd);
    return { previousMonthSummary, currentMonthSummary };
  }

  // Returns attendance summary for last X days or current month (default)
  async getAttendanceSummaryWithDays(
    tenantId: string,
    days?: number,
    page: number = 1,
  ) {
    if (!tenantId) {
      return [];
    }
    const now = new Date();
    let startDate: Date;
    const endDate: Date = now;
    if (days && Number.isFinite(days) && days > 0) {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - days + 1); // inclusive of today
    } else {
      // current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const limit = 25;
    const skip = (page - 1) * limit;
    const employees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('employee.deleted_at IS NULL')
      .andWhere('employee.status = :status', { status: EmployeeStatus.ACTIVE })
      .orderBy('user.first_name', 'ASC')
      .addOrderBy('user.last_name', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();
    if (!employees.length) {
      return [];
    }
    const userIds = employees.map((e) => e.user_id);
    // Attendance
    const rawAttendance = (await this.attendanceRepo
      .createQueryBuilder('attendance')
      .select('attendance.user_id', 'user_id')
      .addSelect(
        "TO_CHAR((attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date, 'YYYY-MM-DD')",
        'day',
      )
      .where('attendance.user_id IN (:...userIds)', { userIds })
      .andWhere('attendance.type = :type', { type: AttendanceType.CHECK_IN })
      .andWhere('attendance.timestamp BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .groupBy('attendance.user_id')
      .addGroupBy(
        "(attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date",
      )
      .getRawMany()) as unknown as Array<{ user_id: string; day: string }>;
    const workedDaysByUser: Record<string, Set<string>> = {};
    for (const row of rawAttendance) {
      const uid = row.user_id;
      const day = row.day;
      if (!workedDaysByUser[uid]) workedDaysByUser[uid] = new Set<string>();
      workedDaysByUser[uid].add(day);
    }
    // Leaves
    const approvedLeaves = await this.leaveRepo.find({
      where: {
        employeeId: In(userIds),
        status: LeaveStatus.APPROVED,
        startDate: Between(startDate as any, endDate as any),
      },
    });
    const informedLeaveDaysByUser: Record<string, number> = {};
    for (const lv of approvedLeaves) {
      const from = new Date(lv.startDate);
      const to = new Date(lv.endDate || lv.startDate);
      const s = from < startDate ? startDate : from;
      const e = to > endDate ? endDate : to;
      let count = 0;
      const dayMs = 24 * 60 * 60 * 1000;
      for (
        let d = new Date(
          Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()),
        );
        d <=
        new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
        d = new Date(d.getTime() + dayMs)
      ) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) count++;
      }
      informedLeaveDaysByUser[lv.employeeId] =
        (informedLeaveDaysByUser[lv.employeeId] || 0) + count;
    }
    // Build response
    const leaveDaysByUser: Record<string, Set<string>> = {};
    for (const lv of approvedLeaves) {
      const from = new Date(lv.startDate);
      const to = new Date(lv.endDate || lv.startDate);
      const s = from < startDate ? startDate : from;
      const e = to > endDate ? endDate : to;
      const dayMs = 24 * 60 * 60 * 1000;
      for (
        let d = new Date(
          Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()),
        );
        d <=
        new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
        d = new Date(d.getTime() + dayMs)
      ) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) {
          const dateStr = d.toISOString().split('T')[0];
          if (!dateStr || !lv.employeeId) continue;
          if (!leaveDaysByUser[lv.employeeId])
            leaveDaysByUser[lv.employeeId] = new Set<string>();
          const userLeaveDays = leaveDaysByUser[lv.employeeId];
          if (userLeaveDays) {
            userLeaveDays.add(dateStr);
          }
        }
      }
    }
    // Helper to compute business days (Mon-Fri) and their dates between two dates, inclusive
    const computeBusinessDaysWithDates = (
      start: Date,
      end: Date,
    ): { count: number; days: string[] } => {
      let count = 0;
      const days: string[] = [];
      const dayMs = 24 * 60 * 60 * 1000;
      const s = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate(),
        ),
      );
      const e = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
      );
      for (let d = s; d <= e; d = new Date(d.getTime() + dayMs)) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) {
          count++;
          const dateStr = d.toISOString().split('T')[0];
          if (dateStr) days.push(dateStr);
        }
      }
      return { count, days };
    };

    return employees.map((emp) => {
      const uid = emp.user_id;
      const presents = workedDaysByUser[uid]?.size || 0;
      const informedLeaves = informedLeaveDaysByUser[uid] || 0;

      // Start counting working days from the later of range startDate or employee joining date
      const employeeStartDate =
        emp.created_at && emp.created_at > startDate
          ? emp.created_at
          : startDate;
      const {
        count: businessDaysInRangeForEmployee,
        days: businessDaysForEmployee,
      } = computeBusinessDaysWithDates(employeeStartDate, endDate);

      const absents = Math.max(
        businessDaysInRangeForEmployee - presents - informedLeaves,
        0,
      );

      // Get present days
      const presentDays = workedDaysByUser[uid] || new Set<string>();
      // Get leave days
      const leaveDays = leaveDaysByUser[uid] || new Set<string>();
      // Absent = in businessDays but not in presentDays and not in leaveDays
      const absentDates = businessDaysForEmployee.filter(
        (date) => !presentDays.has(date) && !leaveDays.has(date),
      );

      return {
        employeeName:
          `${emp.user?.first_name || ''} ${emp.user?.last_name || ''}`.trim(),
        workingDays: businessDaysInRangeForEmployee,
        presents,
        absents,
        informedLeaves,
        department: emp.designation?.department?.name || null,
        designation: emp.designation?.title || null,
        absentDates, // add absent dates in YYYY-MM-DD format for this employee
      };
    });
  }

  // 2. Leave Summary
  async getLeaveSummary(userId?: string, page: number = 1) {
    // Annual entitlement per category
    const ANNUAL_ENTITLEMENT: Record<string, number> = {
      vacation: 4,
      casual: 4,
      sick: 3,
      other: 1,
      emergency: 2,
    };
    const CATEGORIES = Object.keys(ANNUAL_ENTITLEMENT);
    // Monthly cap
    const MONTHLY_CAP_EMPLOYEE = 2;
    const MONTHLY_CAP_MANAGER = 3;

    const limit = 25;
    const skip = (page - 1) * limit;

    // Get all users if userId not provided
    let userIds: string[] = [];
    let total = 0;

    if (userId) {
      userIds = [userId];
      total = 1;
    } else {
      // Get total count for pagination
      total = await this.userRepo.count();

      const users = await this.userRepo.find({
        order: { first_name: 'ASC', last_name: 'ASC' },
        skip,
        take: limit,
      });
      userIds = users.map((u) => u.id);
    }
    const result: Record<string, any> = {};
    const now = new Date();
    const year = now.getFullYear();
    const monthIdx = now.getMonth(); // 0-based
    const startOfMonth = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0));
    const endOfMonth = new Date(
      Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999),
    );
    for (const uid of userIds) {
      // Fetch user with role
      const user = await this.userRepo.findOne({
        where: { id: uid },
        relations: ['role'],
      });
      const isManager =
        user &&
        user.role &&
        user.role.name &&
        user.role.name.toLowerCase() === (UserRole.MANAGER as string);
      const monthlyCap = isManager ? MONTHLY_CAP_MANAGER : MONTHLY_CAP_EMPLOYEE;
      // Get all approved leaves that overlap with the year
      // Check for overlap: leave overlaps with year if startDate <= endOfYear AND endDate >= startOfYear
      const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
      const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      const leaves = await this.leaveRepo
        .createQueryBuilder('leave')
        .where('leave.employeeId = :employeeId', { employeeId: uid })
        .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
        .andWhere('leave.startDate <= :endOfYear', { endOfYear })
        .andWhere('leave.endDate >= :startOfYear', { startOfYear })
        .leftJoinAndSelect('leave.leaveType', 'leaveType')
        .getMany();
      // Used annual
      const used: Record<string, number> = {};
      let _totalUsed = 0;
      for (const cat of CATEGORIES) used[cat] = 0;
      for (const leave of leaves) {
        const leaveTypeName = leave.leaveType?.name?.toLowerCase() || 'other';
        if (
          CATEGORIES.includes(leaveTypeName) &&
          used[leaveTypeName] !== undefined
        ) {
          used[leaveTypeName]++;
          _totalUsed++;
        }
      }
      // Used this month
      const leavesThisMonth = leaves.filter(
        (l) => l.startDate >= startOfMonth && l.startDate <= endOfMonth,
      );
      const usedThisMonth: Record<string, number> = {};
      let totalUsedThisMonth = 0;
      for (const cat of CATEGORIES) usedThisMonth[cat] = 0;
      for (const leave of leavesThisMonth) {
        const leaveTypeName = leave.leaveType?.name?.toLowerCase() || 'other';
        if (
          CATEGORIES.includes(leaveTypeName) &&
          usedThisMonth[leaveTypeName] !== undefined
        ) {
          usedThisMonth[leaveTypeName]++;
          totalUsedThisMonth++;
        }
      }
      // Remaining annual (can go negative if employee has used more than entitlement)
      const remaining: Record<string, number> = {};
      let totalRemaining = 0;
      for (const cat of CATEGORIES) {
        const entitlement = ANNUAL_ENTITLEMENT[cat];
        const usedValue = used[cat];
        if (entitlement !== undefined && usedValue !== undefined) {
          remaining[cat] = entitlement - usedValue;
          totalRemaining += remaining[cat];
        }
      }
      // Compose response
      result[uid] = {
        annualEntitlement: { ...ANNUAL_ENTITLEMENT },
        used: { ...used },
        usedThisMonth: { ...usedThisMonth },
        remaining: { ...remaining },
        totalRemaining,
        monthlyCap,
        totalUsedThisMonth,
        canApplyThisMonth: Math.max(monthlyCap - totalUsedThisMonth, 0),
      };
    }

    const totalPages = Math.ceil(total / limit);

    return {
      items: result,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // 3. Headcount
  async getHeadcount(page: number = 1) {
    const limit = 25;
    const skip = (page - 1) * limit;

    // By department
    const byDepartmentQuery = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.designation', 'designation')
      .leftJoin('designation.department', 'department')
      .where('employee.deleted_at IS NULL')
      .select('department.name', 'department')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('department.name');

    const byDepartmentTotal = await byDepartmentQuery.getCount();
    const byDepartment = await byDepartmentQuery
      .orderBy('department.name', 'ASC')
      .offset(skip)
      .limit(limit)
      .getRawMany();

    // By designation
    const byDesignationQuery = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.designation', 'designation')
      .where('employee.deleted_at IS NULL')
      .select('designation.title', 'designation')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('designation.title');

    const byDesignationTotal = await byDesignationQuery.getCount();
    const byDesignation = await byDesignationQuery
      .orderBy('designation.title', 'ASC')
      .offset(skip)
      .limit(limit)
      .getRawMany();

    // By tenant
    const byTenantQuery = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .leftJoin('user.tenant', 'tenant')
      .where('employee.deleted_at IS NULL')
      .select('tenant.id', 'tenantId')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('tenant.id');

    const byTenantTotal = await byTenantQuery.getCount();
    const byTenant = await byTenantQuery
      .orderBy('tenant.id', 'ASC')
      .offset(skip)
      .limit(limit)
      .getRawMany();

    const maxTotal = Math.max(
      byDepartmentTotal,
      byDesignationTotal,
      byTenantTotal,
    );
    const totalPages = Math.ceil(maxTotal / limit);

    return {
      byDepartment: {
        items: byDepartment,
        total: byDepartmentTotal,
        page,
        limit,
        totalPages,
      },
      byDesignation: {
        items: byDesignation,
        total: byDesignationTotal,
        page,
        limit,
        totalPages,
      },
      byTenant: {
        items: byTenant,
        total: byTenantTotal,
        page,
        limit,
        totalPages,
      },
    };
  }
}
