import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Attendance } from '../../entities/attendance.entity';
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
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  // 1. Attendance Summary
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
      userIds = users.map(u => u.id);
    }

    // Prepare result
    const result: Record<string, any> = {};
    for (const uid of userIds) {
      // Get all check-ins for the user in the month
      const attendances = await this.attendanceRepo.find({
        where: {
          user_id: uid,
          timestamp: Between(startOfMonth, endOfMonth),
          type: 'check-in',
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
      let lateEntries = 0;
      let earlyEntries = 0;
      // For each day, check first check-in time
      for (const [date, records] of Object.entries(days)) {
        totalDaysWorked++;
        // Sort by time
        records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const first = records[0];
        const pkCheckIn = new Date(first.timestamp.getTime() + 5 * 60 * 60 * 1000);
        const hour = pkCheckIn.getHours();
        const min = pkCheckIn.getMinutes();
        // 5PM = 17:00, 6PM = 18:00
        if (hour > 18 || (hour === 18 && min > 0)) {
          lateEntries++;
        } else if (hour < 17) {
          earlyEntries++;
        } else if (hour === 18 && min === 0) {
          // exactly 6:00PM is not late
        } else if (hour === 17 && min < 0) {
          earlyEntries++;
        } else if (hour === 17 && min >= 0) {
          // on time
        } else if (hour === 18 && min === 0) {
          // on time
        }
      }
      // Calculate absences (days in month - totalDaysWorked)
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      // Optionally, skip weekends here if needed
      const absences = daysInMonth - totalDaysWorked;
      result[uid] = {
        totalDaysWorked,
        lateEntries,
        earlyEntries,
        absences,
      };
    }
    return result;
  }

  // 2. Leave Summary
  async getLeaveSummary(userId?: string) {
    // Get all users if userId not provided
    let userIds: string[] = [];
    if (userId) {
      userIds = [userId];
    } else {
      const users = await this.userRepo.find();
      userIds = users.map(u => u.id);
    }
    // For each user, group leaves by type
    const result: Record<string, any> = {};
    for (const uid of userIds) {
      const leaves = await this.leaveRepo.find({ where: { user_id: uid } });
      const summary: Record<string, { used: number }> = {};
      for (const leave of leaves) {
        if (!summary[leave.type]) summary[leave.type] = { used: 0 };
        summary[leave.type].used++;
      }
      // If you have a leave policy, you can add remaining here
      result[uid] = summary;
    }
    return result;
  }

  // 3. Headcount
  async getHeadcount() {
    // By department
    const byDepartment = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.designation', 'designation')
      .leftJoin('designation.department', 'department')
      .select('department.name', 'department')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('department.name')
      .getRawMany();
    // By designation
    const byDesignation = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.designation', 'designation')
      .select('designation.title', 'designation')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('designation.title')
      .getRawMany();
    // By tenant
    const byTenant = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .leftJoin('user.tenant', 'tenant')
      .select('tenant.id', 'tenantId')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('tenant.id')
      .getRawMany();
    return {
      byDepartment,
      byDesignation,
      byTenant,
    };
  }
}
