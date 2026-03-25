import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Leave } from "src/entities/leave.entity";
import { Employee } from "src/entities/employee.entity";
import { LeaveSummaryRow } from "../dto/system-leave/summary.dto";
import { LeaveStatus } from "src/common/constants/enums";

@Injectable()
export class SystemLeaveService {
  constructor(
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
  ) {}

  async findAll(filters?: {
    page?: number;
    tenantId?: string;
    status?: LeaveStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = 25;
    const offset = (page - 1) * limit; 
    const qb = this.leaveRepo
      .createQueryBuilder("leave")
      .leftJoinAndSelect("leave.employee", "user")
      .leftJoinAndSelect("user.tenant", "tenant")
      .leftJoinAndSelect("leave.leaveType", "leaveType")
      .leftJoinAndSelect("user.employees", "employee")
      .leftJoinAndSelect("employee.designation", "designation")
      .leftJoinAndSelect("designation.department", "department")
      .leftJoinAndSelect("employee.user", "empUser"); // Load employee's user to check tenant

    // Filters
    if (filters?.tenantId) {
      qb.andWhere("leave.tenantId = :tenantId", { tenantId: filters.tenantId });
    }

    if (filters?.status) {
      qb.andWhere("leave.status = :status", { status: filters.status });
    }

    if (filters?.startDate && filters?.endDate) {
      qb.andWhere("leave.startDate BETWEEN :startDate AND :endDate", {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    qb.orderBy("leave.createdAt", "DESC");

    const [results, total] = await qb.skip(offset).take(limit).getManyAndCount();

    const data = results.map((l) => {
      // Get the employee record that matches the leave's tenant
      // A user can have multiple employee records across different tenants
      let employeeRecord: Employee | null | undefined = null;
      const employeeRecords = l.employee?.employees || [];
      
      if (employeeRecords.length > 0) {
        // First priority: Find employee record for the same tenant as the leave
        employeeRecord = employeeRecords.find((emp: Employee) => {
          // Check if this employee's user belongs to the leave's tenant
          return emp.user?.tenant_id === l.tenantId;
        });
        
        // Second priority: If no tenant match, get active employee
        if (!employeeRecord) {
          employeeRecord = employeeRecords.find((emp: Employee) => emp.status === 'active');
        }
        
        // Last fallback: Get first employee
        if (!employeeRecord) {
          employeeRecord = employeeRecords[0];
        }
      }
      
      // Get department from the selected employee record
      const department = employeeRecord?.designation?.department;
      
      return {
        id: l.id,
        employeeId: l.employeeId,
        employeeName:
          `${l.employee?.first_name ?? ""} ${l.employee?.last_name ?? ""}`.trim(),
        tenantId: l.tenantId,
        tenantName: l.tenant?.name,
        departmentId: department?.id ?? null,
        departmentName: department?.name ?? null,
        leaveType: l.leaveType?.name,
        startDate: l.startDate,
        endDate: l.endDate,
        totalDays: l.totalDays,
        reason: l.reason,
        status: l.status,
        approvedBy: l.approvedBy,
        approvedAt: l.approvedAt,
        createdAt: l.createdAt,
      };
    });

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSummary(filters?: { startDate?: string; endDate?: string }) {
    const qb = this.leaveRepo
      .createQueryBuilder("leave")
      .leftJoin("leave.tenant", "tenant")
      .select("tenant.id", "tenantId")
      .addSelect("tenant.name", "tenantName")
      .addSelect("tenant.status", "tenantStatus")
      .addSelect("COUNT(leave.id)", "totalLeaves")
      .addSelect(
        `SUM(CASE WHEN leave.status = '${LeaveStatus.APPROVED}' THEN 1 ELSE 0 END)`,
        "approvedCount",
      )
      .addSelect(
        `SUM(CASE WHEN leave.status = '${LeaveStatus.REJECTED}' THEN 1 ELSE 0 END)`,
        "rejectedCount",
      )
      .addSelect(
        `SUM(CASE WHEN leave.status = '${LeaveStatus.PENDING}' THEN 1 ELSE 0 END)`,
        "pendingCount",
      )
      .addSelect(
        `SUM(CASE WHEN leave.status = '${LeaveStatus.CANCELLED}' THEN 1 ELSE 0 END)`,
        "cancelledCount",
      )
      .groupBy("tenant.id")
      .addGroupBy("tenant.name")
      .addGroupBy("tenant.status");

    if (filters?.startDate && filters?.endDate) {
      qb.andWhere("leave.startDate BETWEEN :startDate AND :endDate", {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    const rows: LeaveSummaryRow[] = await qb.getRawMany();

    return rows.map((r) => ({
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      tenantStatus: r.tenantStatus,
      totalLeaves: Number(r.totalLeaves),
      approvedCount: Number(r.approvedCount),
      rejectedCount: Number(r.rejectedCount),
      pendingCount: Number(r.pendingCount),
      cancelledCount: Number(r.cancelledCount),
    }));
  }
}
