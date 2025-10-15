import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from "typeorm";
import { Attendance } from "../../entities/attendance.entity";
import { Leave } from "../../entities/leave.entity";
import { User } from "../../entities/user.entity";
import { Department } from "../../entities/department.entity";
import { Designation } from "../../entities/designation.entity";
import { Employee } from "../../entities/employee.entity";

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
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  // 1. Attendance Summary
  async getAttendanceSummary(userId?: string, month?: string) {
    // Parse month (format: YYYY-MM)
    const now = new Date();
    let year = now.getFullYear();
    let monthIdx = now.getMonth(); // 0-based
    if (month) {
      const [y, m] = month.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m)) {
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
          type: "check-in",
        },
        order: { timestamp: "ASC" },
      });
      // Group by date (Pakistan time)
      const days: Record<string, Attendance[]> = {};
      for (const att of attendances) {
        // Convert UTC to Pakistan time (UTC+5)
        const pkDate = new Date(att.timestamp.getTime() + 5 * 60 * 60 * 1000);
        const dateStr = pkDate.toISOString().split("T")[0];
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

  // 2. Leave Summary
  async getLeaveSummary(userId?: string) {
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

    // Get all users if userId not provided
    let userIds: string[] = [];
    if (userId) {
      userIds = [userId];
    } else {
      const users = await this.userRepo.find();
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
        relations: ["role"],
      });
      const isManager =
        user &&
        user.role &&
        user.role.name &&
        user.role.name.toLowerCase() === "manager";
      const monthlyCap = isManager ? MONTHLY_CAP_MANAGER : MONTHLY_CAP_EMPLOYEE;
      // Get all approved leaves for the year
      const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
      const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      const leaves = await this.leaveRepo.find({
        where: {
          user_id: uid,
          status: "approved",
          from_date: Between(startOfYear, endOfYear),
        },
      });
      // Used annual
      const used: Record<string, number> = {};
      let totalUsed = 0;
      for (const cat of CATEGORIES) used[cat] = 0;
      for (const leave of leaves) {
        if (CATEGORIES.includes(leave.type)) {
          used[leave.type]++;
          totalUsed++;
        }
      }
      // Used this month
      const leavesThisMonth = leaves.filter(
        (l) => l.from_date >= startOfMonth && l.from_date <= endOfMonth,
      );
      const usedThisMonth: Record<string, number> = {};
      let totalUsedThisMonth = 0;
      for (const cat of CATEGORIES) usedThisMonth[cat] = 0;
      for (const leave of leavesThisMonth) {
        if (CATEGORIES.includes(leave.type)) {
          usedThisMonth[leave.type]++;
          totalUsedThisMonth++;
        }
      }
      // Remaining annual
      const remaining: Record<string, number> = {};
      let totalRemaining = 0;
      for (const cat of CATEGORIES) {
        remaining[cat] = Math.max(ANNUAL_ENTITLEMENT[cat] - used[cat], 0);
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
    return result;
  }

  // 3. Headcount
  async getHeadcount() {
    // By department
    const byDepartment = await this.employeeRepo
      .createQueryBuilder("employee")
      .leftJoin("employee.designation", "designation")
      .leftJoin("designation.department", "department")
      .select("department.name", "department")
      .addSelect("COUNT(employee.id)", "count")
      .groupBy("department.name")
      .getRawMany();
    // By designation
    const byDesignation = await this.employeeRepo
      .createQueryBuilder("employee")
      .leftJoin("employee.designation", "designation")
      .select("designation.title", "designation")
      .addSelect("COUNT(employee.id)", "count")
      .groupBy("designation.title")
      .getRawMany();
    // By tenant
    const byTenant = await this.employeeRepo
      .createQueryBuilder("employee")
      .leftJoin("employee.user", "user")
      .leftJoin("user.tenant", "tenant")
      .select("tenant.id", "tenantId")
      .addSelect("COUNT(employee.id)", "count")
      .groupBy("tenant.id")
      .getRawMany();
    return {
      byDepartment,
      byDesignation,
      byTenant,
    };
  }
}
