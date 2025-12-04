import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { AttendanceType, EmployeeStatus, UserRole, LeaveStatus } from '../../common/constants/enums';
import { Leave } from '../../entities/leave.entity';
import { User } from '../../entities/user.entity';
import { Department } from '../../entities/department.entity';
import { Designation } from '../../entities/designation.entity';
import { Employee } from '../../entities/employee.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>
  ) {}

  
  async getAttendanceSummary(userId?: string, month?: string) {
    // Parse month (format: YYYY-MM)
    const now = new Date();
    let year = now.getFullYear();
    let monthIdx = now.getMonth(); // 0-based
    if (month) {
      const [y, m] = month.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        year = y;
        monthIdx = m - 1;
      }
    }
    const startOfMonth = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999));

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
  async getAttendanceSummaryLastDays(tenantId: string, days: number, page: number = 1) {
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
      .andWhere('employee.status = :status', { status: EmployeeStatus.ACTIVE });

    const total = await totalQuery.getCount();

    // Fetch active employees in tenant with user/designation/department info
    const employees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('user.tenant_id = :tenantId', { tenantId })
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
    const rawAttendance = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .select('attendance.user_id', 'user_id')
      .addSelect("TO_CHAR((attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date, 'YYYY-MM-DD')", 'day')
      .where('attendance.user_id IN (:...userIds)', { userIds })
      .andWhere('attendance.type = :type', { type: AttendanceType.CHECK_IN })
      .andWhere('attendance.timestamp BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('attendance.user_id')
      .addGroupBy("(attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date")
      .getRawMany();

    const workedDaysByUser: Record<string, Set<string>> = {};
    for (const row of rawAttendance as any[]) {
      const uid = row.user_id;
      const day = row.day;
      if (!workedDaysByUser[uid]) workedDaysByUser[uid] = new Set<string>();
      workedDaysByUser[uid].add(day);
    }

    // Leaves: sum approved leave days in range (inclusive) by user
    const approvedLeaves = await this.leaveRepo.find({
      where: { employeeId: In(userIds), status: LeaveStatus.APPROVED, startDate: Between(startDate as any, endDate as any) },
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
      for (let d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())); d <= new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())); d = new Date(d.getTime() + dayMs)) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) count++;
      }
      
      // Check if it's an informed leave (you can modify this logic based on your business rules)
      // For now, assuming all approved leaves are "informed leaves"
      informedLeaveDaysByUser[lv.employeeId] = (informedLeaveDaysByUser[lv.employeeId] || 0) + count;
    }

    // Helper to compute business days (Mon-Fri) between two dates, inclusive
    const computeBusinessDays = (start: Date, end: Date): number => {
      let count = 0;
      const dayMs = 24 * 60 * 60 * 1000;
      const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      for (let d = s; d <= e; d = new Date(d.getTime() + dayMs)) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) count++;
      }
      return count;
    };

    // Build response (respect employee joining date)
    const items = employees.map((emp) => {
      const uid = emp.user_id;
      const workedDays = (workedDaysByUser[uid]?.size || 0);
      const informedLeaves = informedLeaveDaysByUser[uid] || 0;
      const otherLeaves = otherLeaveDaysByUser[uid] || 0;
      const totalLeaves = informedLeaves + otherLeaves;

      // Start counting working days from the later of global startDate or employee joining date
      const employeeStartDate =
        emp.created_at && emp.created_at > startDate ? emp.created_at : startDate;
      const businessDaysInRangeForEmployee = computeBusinessDays(employeeStartDate, endDate);

      // Absents are days with no check-in (excluding weekends)
      const absentDays = Math.max(
        businessDaysInRangeForEmployee - workedDays - totalLeaves,
        0,
      );

      return {
        employeeName: `${emp.user?.first_name || ''} ${emp.user?.last_name || ''}`.trim(),
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
    const prevMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999); // last day of previous month
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
      const rawAttendance = await this.attendanceRepo
        .createQueryBuilder('attendance')
        .select('attendance.user_id', 'user_id')
        .addSelect("TO_CHAR((attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date, 'YYYY-MM-DD')", 'day')
        .where('attendance.user_id IN (:...userIds)', { userIds })
        .andWhere('attendance.type = :type', { type: AttendanceType.CHECK_IN })
        .andWhere('attendance.timestamp BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('attendance.user_id')
        .addGroupBy("(attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date")
        .getRawMany();
      const workedDaysByUser: Record<string, Set<string>> = {};
      for (const row of rawAttendance as any[]) {
        const uid = row.user_id;
        const day = row.day;
        if (!workedDaysByUser[uid]) workedDaysByUser[uid] = new Set<string>();
        workedDaysByUser[uid].add(day);
      }
      // Leaves
      const approvedLeaves = await this.leaveRepo.find({
        where: { employeeId: In(userIds), status: LeaveStatus.APPROVED, startDate: Between(startDate as any, endDate as any) },
      });
      const informedLeaveDaysByUser: Record<string, number> = {};
      for (const lv of approvedLeaves) {
        const from = new Date(lv.startDate);
        const to = new Date(lv.endDate || lv.startDate);
        const s = from < startDate ? startDate : from;
        const e = to > endDate ? endDate : to;
        let count = 0;
        const dayMs = 24 * 60 * 60 * 1000;
        for (let d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())); d <= new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())); d = new Date(d.getTime() + dayMs)) {
          const dow = d.getUTCDay();
          if (dow !== 0 && dow !== 6) count++;
        }
        informedLeaveDaysByUser[lv.employeeId] = (informedLeaveDaysByUser[lv.employeeId] || 0) + count;
      }
      // Helper to compute business days (Mon-Fri) between two dates, inclusive
      const computeBusinessDays = (start: Date, end: Date): number => {
        let count = 0;
        const dayMs = 24 * 60 * 60 * 1000;
        const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
        const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
        for (let d = s; d <= e; d = new Date(d.getTime() + dayMs)) {
          const dow = d.getUTCDay();
          if (dow !== 0 && dow !== 6) count++;
        }
        return count;
      };

      // Build response (respect employee joining date)
      return employees.map((emp) => {
        const uid = emp.user_id;
        const presents = (workedDaysByUser[uid]?.size || 0);
        const informedLeaves = informedLeaveDaysByUser[uid] || 0;

        // Start counting working days from the later of range startDate or employee joining date
        const employeeStartDate =
          emp.created_at && emp.created_at > startDate ? emp.created_at : startDate;
        const businessDaysInRangeForEmployee = computeBusinessDays(employeeStartDate, endDate);

        const absents = Math.max(businessDaysInRangeForEmployee - presents - informedLeaves, 0);
        return {
          employeeName: `${emp.user?.first_name || ''} ${emp.user?.last_name || ''}`.trim(),
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
  async getAttendanceSummaryWithDays(tenantId: string, days?: number, page: number = 1) {
    if (!tenantId) {
      return [];
    }
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
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
    const rawAttendance = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .select('attendance.user_id', 'user_id')
      .addSelect("TO_CHAR((attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date, 'YYYY-MM-DD')", 'day')
      .where('attendance.user_id IN (:...userIds)', { userIds })
      .andWhere('attendance.type = :type', { type: AttendanceType.CHECK_IN })
      .andWhere('attendance.timestamp BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('attendance.user_id')
      .addGroupBy("(attendance.timestamp AT TIME ZONE 'UTC' + INTERVAL '5 hours')::date")
      .getRawMany();
    const workedDaysByUser: Record<string, Set<string>> = {};
    for (const row of rawAttendance as any[]) {
      const uid = row.user_id;
      const day = row.day;
      if (!workedDaysByUser[uid]) workedDaysByUser[uid] = new Set<string>();
      workedDaysByUser[uid].add(day);
    }
    // Leaves
    const approvedLeaves = await this.leaveRepo.find({
      where: { employeeId: In(userIds), status: LeaveStatus.APPROVED, startDate: Between(startDate as any, endDate as any) },
    });
    const informedLeaveDaysByUser: Record<string, number> = {};
    for (const lv of approvedLeaves) {
      const from = new Date(lv.startDate);
      const to = new Date(lv.endDate || lv.startDate);
      const s = from < startDate ? startDate : from;
      const e = to > endDate ? endDate : to;
      let count = 0;
      const dayMs = 24 * 60 * 60 * 1000;
      for (let d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())); d <= new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())); d = new Date(d.getTime() + dayMs)) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) count++;
      }
      informedLeaveDaysByUser[lv.employeeId] = (informedLeaveDaysByUser[lv.employeeId] || 0) + count;
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
        let d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
        d <= new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
        d = new Date(d.getTime() + dayMs)
      ) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) {
          const dateStr = d.toISOString().split('T')[0];
          if (!leaveDaysByUser[lv.employeeId]) leaveDaysByUser[lv.employeeId] = new Set<string>();
          leaveDaysByUser[lv.employeeId].add(dateStr);
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
      const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      for (let d = s; d <= e; d = new Date(d.getTime() + dayMs)) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) {
          count++;
          days.push(d.toISOString().split('T')[0]);
        }
      }
      return { count, days };
    };

    return employees.map((emp) => {
      const uid = emp.user_id;
      const presents = (workedDaysByUser[uid]?.size || 0);
      const informedLeaves = informedLeaveDaysByUser[uid] || 0;

      // Start counting working days from the later of range startDate or employee joining date
      const employeeStartDate =
        emp.created_at && emp.created_at > startDate ? emp.created_at : startDate;
      const { count: businessDaysInRangeForEmployee, days: businessDaysForEmployee } =
        computeBusinessDaysWithDates(employeeStartDate, endDate);

      const absents = Math.max(businessDaysInRangeForEmployee - presents - informedLeaves, 0);

      // Get present days
      const presentDays = workedDaysByUser[uid] || new Set<string>();
      // Get leave days
      const leaveDays = leaveDaysByUser[uid] || new Set<string>();
      // Absent = in businessDays but not in presentDays and not in leaveDays
      const absentDates = businessDaysForEmployee.filter(
        (date) => !presentDays.has(date) && !leaveDays.has(date),
      );

      return {
        employeeName: `${emp.user?.first_name || ''} ${emp.user?.last_name || ''}`.trim(),
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
    const ANNUAL_ENTITLEMENT = {
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
    const endOfMonth = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999));
    for (const uid of userIds) {
      // Fetch user with role
      const user = await this.userRepo.findOne({ where: { id: uid }, relations: ['role'] });
      const isManager =
        user && user.role && user.role.name && user.role.name.toLowerCase() === UserRole.MANAGER;
      const monthlyCap = isManager ? MONTHLY_CAP_MANAGER : MONTHLY_CAP_EMPLOYEE;
      // Get all approved leaves for the year
      const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
      const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      const leaves = await this.leaveRepo.find({
        where: {
          employeeId: uid,
          status: LeaveStatus.APPROVED,
          startDate: Between(startOfYear, endOfYear),
        },
        relations: ['leaveType'],
      });
      // Used annual
      const used: Record<string, number> = {};
      let totalUsed = 0;
      for (const cat of CATEGORIES) used[cat] = 0;
      for (const leave of leaves) {
        const leaveTypeName = leave.leaveType?.name?.toLowerCase() || 'other';
        if (CATEGORIES.includes(leaveTypeName)) {
          used[leaveTypeName]++;
          totalUsed++;
        }
      }
      // Used this month
      const leavesThisMonth = leaves.filter(
        (l) => l.startDate >= startOfMonth && l.startDate <= endOfMonth
      );
      const usedThisMonth: Record<string, number> = {};
      let totalUsedThisMonth = 0;
      for (const cat of CATEGORIES) usedThisMonth[cat] = 0;
      for (const leave of leavesThisMonth) {
        const leaveTypeName = leave.leaveType?.name?.toLowerCase() || 'other';
        if (CATEGORIES.includes(leaveTypeName)) {
          usedThisMonth[leaveTypeName]++;
          totalUsedThisMonth++;
        }
      }
      // Remaining annual (can go negative if employee has used more than entitlement)
      const remaining: Record<string, number> = {};
      let totalRemaining = 0;
      for (const cat of CATEGORIES) {
        remaining[cat] = ANNUAL_ENTITLEMENT[cat] - used[cat];
        totalRemaining += remaining[cat];
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
      .select('tenant.id', 'tenantId')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('tenant.id');

    const byTenantTotal = await byTenantQuery.getCount();
    const byTenant = await byTenantQuery
      .orderBy('tenant.id', 'ASC')
      .offset(skip)
      .limit(limit)
      .getRawMany();

    const maxTotal = Math.max(byDepartmentTotal, byDesignationTotal, byTenantTotal);
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
