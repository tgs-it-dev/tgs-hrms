import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";
import { SystemLog } from "src/entities/system-log.entity";
import { toCsv } from "src/common/utils/csv.util";

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

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

    const activeEmployeesPerTenant = await this.employeeRepo
      .createQueryBuilder("employee")
      .innerJoin("employee.user", "user")
      .select("user.tenant_id", "tenantId")
      .addSelect("COUNT(employee.id)", "activeCount")
      .where("employee.status = :status", { status: "active" })
      .groupBy("user.tenant_id")
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
   * Paginated system logs
   */
  async getSystemLogs(page: number = 1) {
    const skip = (page - 1) * 25;

    const logs = await this.systemLogRepo.find({
      order: { createdAt: "DESC" },
      skip,
      take: 25,
    });

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
}
