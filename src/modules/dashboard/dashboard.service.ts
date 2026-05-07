import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, In } from "typeorm";
import { Employee } from "../../entities/employee.entity";
import { Attendance } from "../../entities/attendance.entity";
import { Team } from "../../entities/team.entity";
import { User } from "../../entities/user.entity";
import { Leave } from "../../entities/leave.entity";
import {
  AttendanceType,
  CheckInApprovalStatus,
  LeaveStatus,
  UserRole,
} from "../../common/constants/enums";
import { EmployeeService } from "../employee/services/employee.service";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

@Injectable()
export class DashboardService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs = 60 * 1000;

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
    private readonly employeeService: EmployeeService,
  ) {}

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private setCache<T>(
    key: string,
    value: T,
    ttlMs: number = this.defaultTtlMs,
  ): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * GET /dashboard/kpi
   */
  async getKpiMetrics(params: {
    tenantId: string;
    userId: string;
    role: string;
  }) {
    const { tenantId, userId, role } = params;
    const cacheKey = `kpi:${tenantId}:${role}:${userId}`;
    const cached = this.getCache<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    let employeeIds: string[] = [];

    if (role === UserRole.MANAGER) {
      const teams = await this.teamRepo.find({
        where: { manager_id: userId },
        relations: ["teamMembers", "teamMembers.user"],
      });
      const members = teams.flatMap((t) => t.teamMembers || []);
      employeeIds = members
        .filter((e) => e.user?.tenant_id === tenantId)
        .map((e) => e.id);
    } else if (role === UserRole.EMPLOYEE) {
      const employee = await this.employeeRepo.findOne({
        where: { user_id: userId },
        relations: ["user"],
      });
      employeeIds =
        employee && employee.user?.tenant_id === tenantId ? [employee.id] : [];
    } else {
      const employees = await this.employeeRepo
        .createQueryBuilder("employee")
        .leftJoin("employee.user", "user")
        .where("user.tenant_id = :tenantId", { tenantId })
        .getMany();
      employeeIds = employees.map((e) => e.id);
    }

    if (!employeeIds.length) {
      const empty = {
        total_employees: 0,
        total_salary: 0,
        salary_paid: 0,
        salary_unpaid: 0,
        employees_present_today: 0,
        employees_on_leave_today: 0,
        timestamp: now.toISOString(),
      };
      this.setCache(cacheKey, empty);
      return empty;
    }

    const totalEmployees = employeeIds.length;

    const attendanceRecords = await this.attendanceRepo.find({
      where: {
        timestamp: Between(startOfDay, endOfDay),
        type: In([AttendanceType.CHECK_IN, AttendanceType.CHECK_OUT]),
      },
      relations: ["user"],
    });

    const presentUserIds = new Set<string>();
    const todayCheckIns = attendanceRecords.filter(
      (a) =>
        a.type === AttendanceType.CHECK_IN &&
        a.user?.tenant_id === tenantId &&
        a.approval_status !== CheckInApprovalStatus.REJECTED,
    );
    const todayCheckOuts = attendanceRecords.filter(
      (a) => a.type === AttendanceType.CHECK_OUT && a.user?.tenant_id === tenantId,
    );

    for (const checkIn of todayCheckIns) {
      const matchingCheckOut = todayCheckOuts.find(
        (co) =>
          co.user_id === checkIn.user_id &&
          co.timestamp > checkIn.timestamp &&
          co.timestamp.toDateString() === checkIn.timestamp.toDateString(),
      );
      if (matchingCheckOut) {
        presentUserIds.add(checkIn.user_id);
      }
    }

    const employeesForScope = await this.employeeRepo.find({
      where: { id: In(employeeIds) },
      relations: ["user"],
    });
    const scopedPresentEmployeeIds = new Set(
      employeesForScope
        .filter((e) => presentUserIds.has(e.user_id))
        .map((e) => e.id),
    );

    const employeesPresentToday = scopedPresentEmployeeIds.size;

    const todayDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const leavesToday = await this.leaveRepo
      .createQueryBuilder("leave")
      .where("leave.tenantId = :tenantId", { tenantId })
      .andWhere("leave.status = :status", { status: LeaveStatus.APPROVED })
      .andWhere("leave.startDate <= :today", { today: todayDate })
      .andWhere("leave.endDate >= :today", { today: todayDate })
      .getMany();

    const leaveUserIds = new Set(leavesToday.map((l) => l.employeeId));
    const scopedLeaveEmployeeIds = new Set(
      employeesForScope
        .filter((e) => leaveUserIds.has(e.user_id))
        .map((e) => e.id),
    );

    const employeesOnLeaveToday = scopedLeaveEmployeeIds.size;

    const result = {
      total_employees: totalEmployees,
      total_salary: 0,
      salary_paid: 0,
      salary_unpaid: 0,
      employees_present_today: employeesPresentToday,
      employees_on_leave_today: employeesOnLeaveToday,
      timestamp: now.toISOString(),
    };

    this.setCache(cacheKey, result);
    return result;
  }

  async getEmployeeGrowth(tenantId: string) {
    const cacheKey = `employee-growth:${tenantId}`;
    const cached = this.getCache<unknown[]>(cacheKey);
    if (cached) return cached;

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const joiningReport =
      await this.employeeService.getEmployeeJoiningReport(tenantId);

    if (!joiningReport || joiningReport.length === 0) {
      this.setCache(cacheKey, []);
      return [];
    }

    joiningReport.sort((a: { year: number; month: number }, b: { year: number; month: number }) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    let cumulative = 0;
    const result = joiningReport.map(
      (entry: { year: number; month: number; total?: number }) => {
        cumulative += entry.total || 0;
        const monthIndex = (entry.month || 1) - 1;
        return {
          month: `${monthNames[monthIndex]} ${entry.year}`,
          total: cumulative,
        };
      },
    );

    this.setCache(cacheKey, result, 5 * this.defaultTtlMs);
    return result;
  }

  async getAttendanceSummary(params: {
    tenantId: string;
    userId: string;
    role: string;
    date?: string;
  }) {
    const { tenantId, userId, role } = params;
    const target = params.date ? new Date(params.date) : new Date();
    const day = new Date(
      target.getFullYear(),
      target.getMonth(),
      target.getDate(),
    );
    const startOfDay = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      23,
      59,
      59,
      999,
    );

    const cacheKey = `attendance-summary:${tenantId}:${role}:${userId}:${startOfDay.toISOString()}`;
    const cached = this.getCache<unknown[]>(cacheKey);
    if (cached) return cached;

    const employeeQb = this.employeeRepo
      .createQueryBuilder("employee")
      .leftJoinAndSelect("employee.user", "user")
      .leftJoinAndSelect("employee.designation", "designation")
      .leftJoinAndSelect("designation.department", "department")
      .where("user.tenant_id = :tenantId", { tenantId });

    if (role === UserRole.MANAGER) {
      employeeQb
        .leftJoin("employee.team", "team")
        .andWhere("team.manager_id = :managerId", { managerId: userId });
    } else if (role === UserRole.EMPLOYEE) {
      employeeQb.andWhere("employee.user_id = :userId", { userId });
    }

    const employees = await employeeQb.getMany();
    if (!employees.length) {
      this.setCache(cacheKey, []);
      return [];
    }

    const userIds = employees.map((e) => e.user_id);

    const attendances = await this.attendanceRepo.find({
      where: {
        user_id: In(userIds),
        timestamp: Between(startOfDay, endOfDay),
        type: In([AttendanceType.CHECK_IN, AttendanceType.CHECK_OUT]),
      },
    });

    const checkIns = attendances.filter(
      (a) =>
        a.type === AttendanceType.CHECK_IN &&
        a.approval_status !== CheckInApprovalStatus.REJECTED,
    );
    const checkOuts = attendances.filter(
      (a) => a.type === AttendanceType.CHECK_OUT,
    );

    const presentUserIds = new Set<string>();
    for (const checkIn of checkIns) {
      const matchingCheckOut = checkOuts.find(
        (co) =>
          co.user_id === checkIn.user_id &&
          co.timestamp > checkIn.timestamp &&
          co.timestamp.toDateString() === checkIn.timestamp.toDateString(),
      );
      if (matchingCheckOut) {
        presentUserIds.add(checkIn.user_id);
      }
    }

    const leaveRecords = await this.leaveRepo
      .createQueryBuilder("leave")
      .where("leave.tenantId = :tenantId", { tenantId })
      .andWhere("leave.status = :status", { status: LeaveStatus.APPROVED })
      .andWhere("leave.startDate <= :day", { day })
      .andWhere("leave.endDate >= :day", { day })
      .andWhere("leave.employeeId IN (:...userIds)", { userIds })
      .getMany();

    const leaveUserIds = new Set(leaveRecords.map((l) => l.employeeId));

    const summaryMap: Record<
      string,
      { department: string; total: number; present: number; absent: number }
    > = {};

    for (const emp of employees) {
      const deptName = emp.designation?.department?.name || "Unassigned";
      if (!summaryMap[deptName]) {
        summaryMap[deptName] = {
          department: deptName,
          total: 0,
          present: 0,
          absent: 0,
        };
      }
      const entry = summaryMap[deptName];
      entry.total += 1;

      const isOnLeave = leaveUserIds.has(emp.user_id);
      const isPresent = presentUserIds.has(emp.user_id) && !isOnLeave;

      if (isPresent) {
        entry.present += 1;
      } else if (!isOnLeave) {
        entry.absent += 1;
      }
    }

    const result = Object.values(summaryMap);
    this.setCache(cacheKey, result);
    return result;
  }

  async getEmployeeAvailability(tenantId: string) {
    const cacheKey = `employee-availability:${tenantId}`;
    const cached = this.getCache<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const stats = await this.employeeService.getGenderPercentage(tenantId);
    const other = Math.max(0, stats.total - stats.male - stats.female);

    const result = {
      gender: {
        male: stats.male,
        female: stats.female,
        other,
      },
      status: {
        active: stats.activeEmployees,
        inactive: stats.inactiveEmployees,
        total: stats.total,
      },
    };

    this.setCache(cacheKey, result, 5 * this.defaultTtlMs);
    return result;
  }

  async getAlerts(params: { tenantId: string; userId: string; role: string }) {
    const { tenantId, userId, role } = params;
    const cacheKey = `alerts:${tenantId}:${role}:${userId}`;
    const cached = this.getCache<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    let scopedUserIds: string[] = [];

    if (role === UserRole.MANAGER) {
      const teams = await this.teamRepo.find({
        where: { manager_id: userId },
        relations: ["teamMembers", "teamMembers.user"],
      });
      const members = teams.flatMap((t) => t.teamMembers || []);
      scopedUserIds = members
        .filter((e) => e.user?.tenant_id === tenantId)
        .map((e) => e.user_id);
    } else if (role === UserRole.EMPLOYEE) {
      scopedUserIds = [userId];
    } else {
      const users = await this.userRepo.find({
        where: { tenant_id: tenantId },
      });
      scopedUserIds = users.map((u) => u.id);
    }

    if (!scopedUserIds.length) {
      const empty = {
        auto_checkouts: [],
        pending_approvals: [],
        salary_issues: [],
        timestamp: now.toISOString(),
      };
      this.setCache(cacheKey, empty);
      return empty;
    }

    const yAttendances = await this.attendanceRepo.find({
      where: {
        user_id: In(scopedUserIds),
        timestamp: Between(yesterdayStart, yesterdayEnd),
        type: In([AttendanceType.CHECK_IN, AttendanceType.CHECK_OUT]),
      },
      relations: ["user"],
    });

    const yCheckIns = yAttendances.filter((a) => a.type === AttendanceType.CHECK_IN);
    const yCheckOuts = yAttendances.filter((a) => a.type === AttendanceType.CHECK_OUT);

    const autoCheckouts: Array<Record<string, unknown>> = [];
    for (const checkIn of yCheckIns) {
      const matching = yCheckOuts.find(
        (co) =>
          co.user_id === checkIn.user_id &&
          co.timestamp > checkIn.timestamp &&
          co.timestamp.toDateString() === checkIn.timestamp.toDateString(),
      );
      if (!matching) {
        autoCheckouts.push({
          user_id: checkIn.user_id,
          employee: {
            first_name: checkIn.user?.first_name,
            last_name: checkIn.user?.last_name,
            email: checkIn.user?.email,
          },
          check_in_time: checkIn.timestamp,
          message:
            "Check-in without matching check-out detected (yesterday)",
        });
      }
    }

    const todayCheckIns = await this.attendanceRepo.find({
      where: {
        user_id: In(scopedUserIds),
        timestamp: Between(todayStart, now),
        type: AttendanceType.CHECK_IN,
        approval_status: CheckInApprovalStatus.PENDING,
      },
      relations: ["user"],
    });

    const pendingApprovals = todayCheckIns.map((checkIn) => ({
      id: checkIn.id,
      user_id: checkIn.user_id,
      employee: {
        first_name: checkIn.user?.first_name,
        last_name: checkIn.user?.last_name,
        email: checkIn.user?.email,
      },
      check_in_time: checkIn.timestamp,
      approval_status: checkIn.approval_status,
      message: "Pending check-in approval",
    }));

    const result = {
      auto_checkouts: autoCheckouts,
      pending_approvals: pendingApprovals,
      salary_issues: [] as unknown[],
      timestamp: now.toISOString(),
    };

    this.setCache(cacheKey, result, this.defaultTtlMs);
    return result;
  }
}
