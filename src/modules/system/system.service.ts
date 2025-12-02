import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";
import { Department } from "src/entities/department.entity";
import { Designation } from "src/entities/designation.entity";
import { SystemLog } from "src/entities/system-log.entity";
import { toCsv } from "src/common/utils/csv.util";

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,

    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,

    @InjectRepository(SystemLog)
    private readonly systemLogRepo: Repository<SystemLog>,
  ) {}

  /**
   * Dashboard Summary
   * - Total tenants
   * - Active tenants
   * - Total employees
   * - Active employees per tenant
   * - System uptime
   * - Recent activity logs (latest 10 system logs)
   */
  async getDashboardSummary() {
    const totalTenants = await this.tenantRepo.count();
    const activeTenants = await this.tenantRepo.count({
      where: { status: "active" },
    });

    const totalEmployees = await this.employeeRepo.count();

    // const activeEmployeesPerTenant = await this.employeeRepo
    //   .createQueryBuilder("employee")
    //   .innerJoin("employee.user", "user")
    //   .select("user.tenant_id", "tenantId")
    //   .addSelect("COUNT(employee.id)", "activeCount")
    //   .where("employee.status = :status", { status: "active" })
    //   .groupBy("user.tenant_id")
    //   .orderBy("COUNT(employee.id)", "DESC")
    //   .getRawMany();

    const activeEmployeesPerTenant = await this.employeeRepo
  .createQueryBuilder("employee")
  .innerJoin("employee.user", "user")
  .innerJoin("user.tenant", "tenant")
  .select("user.tenant_id", "tenantId")
  .addSelect("tenant.name", "tenantName")
  .addSelect("COUNT(employee.id)", "activeCount")
  .where("employee.status = :status", { status: "active" })
  .andWhere("tenant.status = :tenantStatus", { tenantStatus: "active" })
  .andWhere("tenant.isDeleted = :isDeleted", { isDeleted: false })
  .groupBy("user.tenant_id")
  .addGroupBy("tenant.name")
  .orderBy("COUNT(employee.id)", "DESC")
  .getRawMany();

    const systemUptimeSeconds = Math.floor(process.uptime());

    let recentLogs = await this.systemLogRepo.find({
      order: { createdAt: "DESC" },
      take: 10,
    });

    recentLogs = recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      userId: log.userId,
      userRole: log.userRole,
      tenantId: log.tenantId,
      route: log.route,
      method: log.method,
      ip: log.ip,
      meta: log.meta,
      createdAt: log.createdAt,
    }));

    return {
      totalTenants,
      activeTenants,
      totalEmployees,
      activeEmployeesPerTenant,
      systemUptimeSeconds,
      recentLogs,
    };
  }

  /**
   * Paginated system logs with optional filters
   * Filters:
   * - userRole: filter by user role who triggered the log
   * - tenantId: filter by tenant
   * - method: HTTP method (GET, POST, PATCH, PUT, DELETE, etc.)
   */
  async getSystemLogs(
    page: number = 1,
    filters?: {
      userRole?: string;
      tenantId?: string;
      method?: string;
    },
  ) {
    const take = 25;
    const skip = (page - 1) * take;

    const query = this.systemLogRepo
      .createQueryBuilder("log")
      .orderBy("log.createdAt", "DESC")
      .skip(skip)
      .take(take);

    if (filters?.userRole) {
      query.andWhere("log.userRole = :userRole", { userRole: filters.userRole });
    }

    if (filters?.tenantId) {
      query.andWhere("log.tenantId = :tenantId", { tenantId: filters.tenantId });
    }

    if (filters?.method) {
      query.andWhere("log.method = :method", { method: filters.method.toUpperCase() });
    }

    const logs = await query.getMany();

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      userId: log.userId,
      userRole: log.userRole,
      tenantId: log.tenantId,
      route: log.route,
      method: log.method,
      ip: log.ip,
      meta: log.meta,
      createdAt: log.createdAt,
    }));
  }

  /**
   * Export system logs to CSV (latest 1000 entries)
   */
  async exportSystemLogs(): Promise<string> {
    const logs = await this.systemLogRepo.find({
      order: { createdAt: "DESC" },
      take: 1000,
    });

    if (!logs || logs.length === 0) {
      throw new NotFoundException("No system logs available for export");
    }

    const csvData = logs.map((log) => ({
      Timestamp: log.createdAt,
      Action: log.action,
      EntityType: log.entityType,
      UserId: log.userId,
      UserRole: log.userRole,
      TenantId: log.tenantId,
      Route: log.route,
      Method: log.method,
      IP: log.ip,
      Meta: log.meta ? JSON.stringify(log.meta) : "",
    }));

    return toCsv(csvData);
  }

  /**
   * Get Tenant Growth Overview
   * Returns month-wise cumulative counts of employees, departments, and designations
   * @param year - Year for growth data (e.g., 2025)
   * @param tenant_id - Tenant ID (required)
   */
  async getTenantGrowthOverview(year: number, tenant_id: string) {
    if (!tenant_id) {
      throw new NotFoundException("Tenant ID is required");
    }

    // Fetch tenant information
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenant_id },
      select: ['id', 'name'],
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    // Generate months up to current month only (exclude future months)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11
    
    let months: number[];
    if (year === currentYear) {
      // For current year, only include months up to current month
      months = Array.from({ length: currentMonth }, (_, i) => i + 1);
    } else if (year > currentYear) {
      // Future year - return empty array
      months = [];
    } else {
      // Past year - include all 12 months
      months = Array.from({ length: 12 }, (_, i) => i + 1);
    }

    // Get monthly new additions (non-cumulative) for each entity
    // Employees: New employees created per month
    const employeeMonthlyAdditions = await this.employeeRepo
      .createQueryBuilder("employee")
      .innerJoin("employee.user", "user")
      .select("TO_CHAR(employee.created_at, 'YYYY-MM')", "month")
      .addSelect("COUNT(employee.id)", "count")
      .where("EXTRACT(YEAR FROM employee.created_at) = :year", { year })
      .andWhere("user.tenant_id = :tenant_id", { tenant_id })
      .groupBy("month")
      .orderBy("month", "ASC")
      .getRawMany();

    // Departments: New departments created per month
    const departmentMonthlyAdditions = await this.departmentRepo
      .createQueryBuilder("department")
      .select("TO_CHAR(department.created_at, 'YYYY-MM')", "month")
      .addSelect("COUNT(department.id)", "count")
      .where("EXTRACT(YEAR FROM department.created_at) = :year", { year })
      .andWhere("department.tenant_id = :tenant_id", { tenant_id })
      .groupBy("month")
      .orderBy("month", "ASC")
      .getRawMany();

    // Designations: New designations created per month (tenant-based)
    const designationMonthlyAdditions = await this.designationRepo
      .createQueryBuilder("designation")
      .innerJoin("designation.department", "department")
      .select("TO_CHAR(designation.created_at, 'YYYY-MM')", "month")
      .addSelect("COUNT(designation.id)", "count")
      .where("EXTRACT(YEAR FROM designation.created_at) = :year", { year })
      .andWhere("designation.tenant_id = :tenant_id", { tenant_id })
      .groupBy("month")
      .orderBy("month", "ASC")
      .getRawMany();

    // Get baseline counts (total created before the specified year)
    const baselineEmployees = await this.employeeRepo
      .createQueryBuilder("employee")
      .innerJoin("employee.user", "user")
      .where("EXTRACT(YEAR FROM employee.created_at) < :year", { year })
      .andWhere("user.tenant_id = :tenant_id", { tenant_id })
      .getCount();

    const baselineDepartments = await this.departmentRepo
      .createQueryBuilder("department")
      .where("EXTRACT(YEAR FROM department.created_at) < :year", { year })
      .andWhere("department.tenant_id = :tenant_id", { tenant_id })
      .getCount();

    const baselineDesignations = await this.designationRepo
      .createQueryBuilder("designation")
      .innerJoin("designation.department", "department")
      .where("EXTRACT(YEAR FROM designation.created_at) < :year", { year })
      .andWhere("designation.tenant_id = :tenant_id", { tenant_id })
      .getCount();

    // Initialize cumulative counters with baseline
    let cumulativeEmployees = baselineEmployees;
    let cumulativeDepartments = baselineDepartments;
    let cumulativeDesignations = baselineDesignations;

    // Process each month sequentially to maintain correct cumulative totals
    const growthData: Array<{
      tenantId: string;
      tenantName: string;
      month: string;
      monthName: string;
      employees: number;
      departments: number;
      designations: number;
    }> = [];
    for (const month of months) {
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const monthName = new Date(year, month - 1).toLocaleString("default", {
        month: "short",
      });

      // Find additions for this month
      const newEmployees =
        employeeMonthlyAdditions.find((e) => e.month === monthKey)?.count ||
        "0";
      const newDepartments =
        departmentMonthlyAdditions.find((d) => d.month === monthKey)?.count ||
        "0";
      const newDesignations =
        designationMonthlyAdditions.find((d) => d.month === monthKey)?.count ||
        "0";

      // Update cumulative totals
      cumulativeEmployees += parseInt(newEmployees, 10);
      cumulativeDepartments += parseInt(newDepartments, 10);
      cumulativeDesignations += parseInt(newDesignations, 10);

      growthData.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        month: monthKey,
        monthName: monthName,
        employees: cumulativeEmployees,
        departments: cumulativeDepartments,
        designations: cumulativeDesignations,
      });
    }

    return growthData;
  }
}
