import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { Leave } from "../../entities/leave.entity";
import { LeaveType } from "../../entities/leave-type.entity";
import { User } from "../../entities/user.entity";
import { Employee } from "../../entities/employee.entity";
import { LeaveStatus } from "../../common/constants/enums";
import { TenantDatabaseService } from "../../common/services/tenant-database.service";

@Injectable()
export class LeaveReportsService {
  constructor(
    @InjectRepository(Leave)
    private leaveRepo: Repository<Leave>,
    @InjectRepository(LeaveType)
    private leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
    private readonly tenantDbService: TenantDatabaseService,
    private readonly dataSource: DataSource,
  ) {}

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<
      Array<{ schema_provisioned: boolean }>
    >(`SELECT schema_provisioned FROM public.tenants WHERE id = $1`, [
      tenantId,
    ]);
    return result?.[0]?.schema_provisioned === true;
  }

  private async runInTenantContext<T>(
    tenantId: string,
    work: (
      leaveRepo: Repository<Leave>,
      leaveTypeRepo: Repository<LeaveType>,
      employeeRepo: Repository<Employee>,
      em: EntityManager | null,
    ) => Promise<T>,
  ): Promise<T> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        work(
          em.getRepository(Leave),
          em.getRepository(LeaveType),
          em.getRepository(Employee),
          em,
        ),
      );
    }
    return work(this.leaveRepo, this.leaveTypeRepo, this.employeeRepo, null);
  }

  async getLeaveSummary(employeeId: string, year: number, tenantId: string) {
    const employee = await this.userRepo.findOne({
      where: { id: employeeId, tenant_id: tenantId },
    });
    if (!employee) throw new NotFoundException("Employee not found");

    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    return this.runInTenantContext(
      tenantId,
      async (leaveRepo, leaveTypeRepo) => {
        const leaveTypes = await leaveTypeRepo.find({
          where: { tenantId, status: "active" },
        });

        const summary = await Promise.all(
          leaveTypes.map(async (leaveType) => {
            const leaves = await leaveRepo
              .createQueryBuilder("leave")
              .where("leave.employeeId = :employeeId", { employeeId })
              .andWhere("leave.leaveTypeId = :leaveTypeId", {
                leaveTypeId: leaveType.id,
              })
              .andWhere("leave.status = :status", {
                status: LeaveStatus.APPROVED,
              })
              .andWhere("leave.startDate <= :endOfYear", { endOfYear })
              .andWhere("leave.endDate >= :startOfYear", { startOfYear })
              .getMany();

            const used = leaves.reduce(
              (total, leave) =>
                total +
                this.calculateWorkingDaysInRange(
                  leave.startDate,
                  leave.endDate,
                  startOfYear,
                  endOfYear,
                ),
              0,
            );
            return {
              type: leaveType.name,
              used,
              remaining: leaveType.maxDaysPerYear - used,
            };
          }),
        );

        return { employeeId, year, summary };
      },
    );
  }

  async getTeamLeaveSummary(
    managerId: string,
    month: number,
    year: number,
    tenantId: string,
  ) {
    const manager = await this.userRepo.findOne({
      where: { id: managerId, tenant_id: tenantId },
    });
    if (!manager) throw new NotFoundException("Manager not found");

    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    return this.runInTenantContext(
      tenantId,
      async (leaveRepo, _lt, employeeRepo) => {
        const teamMembers = await employeeRepo
          .createQueryBuilder("employee")
          .leftJoinAndSelect("employee.user", "user")
          .leftJoinAndSelect("employee.designation", "designation")
          .leftJoinAndSelect("designation.department", "department")
          .leftJoin("employee.team", "team")
          .where("user.tenant_id = :tenantId", { tenantId })
          .andWhere("employee.deleted_at IS NULL")
          .andWhere("team.manager_id = :managerId", { managerId })
          .andWhere("employee.user_id != :managerId", { managerId })
          .getMany();

        const teamLeaveData = await Promise.all(
          teamMembers.map(async (member) => {
            const leaves = await leaveRepo
              .createQueryBuilder("leave")
              .where("leave.employeeId = :employeeId", {
                employeeId: member.user_id,
              })
              .andWhere("leave.status = :status", {
                status: LeaveStatus.APPROVED,
              })
              .andWhere("leave.startDate <= :endOfMonth", { endOfMonth })
              .andWhere("leave.endDate >= :startOfMonth", { startOfMonth })
              .leftJoinAndSelect("leave.leaveType", "leaveType")
              .getMany();

            const leaveSummary = leaves.map((leave) => ({
              type: leave.leaveType.name,
              days: this.calculateWorkingDaysInRange(
                leave.startDate,
                leave.endDate,
                startOfMonth,
                endOfMonth,
              ),
              startDate: leave.startDate,
              endDate: leave.endDate,
            }));

            return {
              employeeId: member.user_id,
              name: `${member.user.first_name} ${member.user.last_name}`,
              email: member.user.email,
              department: member.designation?.department?.name || "N/A",
              designation: member.designation?.title || "N/A",
              leaves: leaveSummary,
              totalLeaveDays: leaveSummary.reduce(
                (total, l) => total + l.days,
                0,
              ),
            };
          }),
        );

        return {
          managerId,
          month,
          year,
          teamMembers: teamLeaveData,
          totalTeamMembers: teamMembers.length,
          membersOnLeave: teamLeaveData.filter(
            (member) => member.totalLeaveDays > 0,
          ).length,
        };
      },
    );
  }

  async getLeaveBalance(
    employeeId: string,
    tenantId: string,
    year?: number,
    month?: number,
  ) {
    const employee = await this.userRepo.findOne({
      where: { id: employeeId, tenant_id: tenantId },
    });
    if (!employee) throw new NotFoundException("Employee not found");

    const targetYear = year ?? new Date().getFullYear();
    const validMonth = month && month >= 1 && month <= 12;

    return this.runInTenantContext(
      tenantId,
      async (leaveRepo, leaveTypeRepo) => {
        const leaveTypes = await leaveTypeRepo.find({
          where: { tenantId, status: "active" },
        });
        const balances = await this.calculateEmployeeLeaveBalance(
          employeeId,
          targetYear,
          leaveTypes,
          leaveRepo,
          validMonth ? month : undefined,
        );
        return {
          employeeId,
          year: targetYear,
          ...(validMonth ? { month } : {}),
          balances,
        };
      },
    );
  }

  async getAllLeaveReports(
    tenantId: string,
    page: number = 1,
    year?: number,
    employeeName?: string,
  ) {
    const targetYear = year ?? new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    const limit = 25;
    const skip = (page - 1) * limit;

    return this.runInTenantContext(
      tenantId,
      async (leaveRepo, leaveTypeRepo, employeeRepo) => {
        const employeeQuery = employeeRepo
          .createQueryBuilder("employee")
          .leftJoinAndSelect("employee.user", "user")
          .leftJoinAndSelect("employee.designation", "designation")
          .leftJoinAndSelect("designation.department", "department")
          .where("user.tenant_id = :tenantId", { tenantId })
          .andWhere("employee.deleted_at IS NULL");

        if (employeeName) {
          const trimmedName = employeeName.trim().replace(/\s+/g, " ");
          employeeQuery.andWhere(
            `LOWER(TRIM(CONCAT(COALESCE(user.first_name, ''), ' ', COALESCE(user.last_name, '')))) = LOWER(:name)`,
            { name: trimmedName },
          );
        }

        const [allEmployees, total] = await employeeQuery
          .orderBy("user.first_name", "ASC")
          .skip(skip)
          .take(limit)
          .getManyAndCount();

        const employeeIds = allEmployees.map((e) => e.user_id);
        const leavesByEmployee: Record<string, Leave[]> = {};

        if (employeeIds.length > 0) {
          const leaves = await leaveRepo
            .createQueryBuilder("leave")
            .leftJoinAndSelect("leave.leaveType", "leaveType")
            .where("leave.employeeId IN (:...employeeIds)", { employeeIds })
            .andWhere("leave.startDate <= :endDate", { endDate })
            .andWhere("leave.endDate >= :startDate", { startDate })
            .getMany();

          leaves.forEach((leave) => {
            if (!leavesByEmployee[leave.employeeId])
              leavesByEmployee[leave.employeeId] = [];
            leavesByEmployee[leave.employeeId].push(leave);
          });
        }

        const leaveTypes = await leaveTypeRepo.find({
          where: { tenantId, status: "active" },
        });

        const employeeReportsWithBalances = await Promise.all(
          allEmployees.map(async (employee) => {
            const balances = await this.calculateEmployeeLeaveBalance(
              employee.user_id,
              targetYear,
              leaveTypes,
              leaveRepo,
            );
            return { employee, balances };
          }),
        );

        const employeeReports = employeeReportsWithBalances.map(
          ({ employee, balances }) => {
            const employeeYearLeaves = leavesByEmployee[employee.user_id] || [];

            const leaveSummary = balances.map((balance) => {
              const typeLeaves = employeeYearLeaves.filter(
                (l) => l.leaveTypeId === balance.leaveTypeId,
              );
              const pendingDays = typeLeaves
                .filter((l) => l.status === LeaveStatus.PENDING)
                .reduce(
                  (sum, l) =>
                    sum +
                    this.calculateWorkingDaysInRange(
                      l.startDate,
                      l.endDate,
                      startDate,
                      endDate,
                    ),
                  0,
                );
              const rejectedDays = typeLeaves
                .filter((l) => l.status === LeaveStatus.REJECTED)
                .reduce(
                  (sum, l) =>
                    sum +
                    this.calculateWorkingDaysInRange(
                      l.startDate,
                      l.endDate,
                      startDate,
                      endDate,
                    ),
                  0,
                );
              return {
                leaveTypeId: balance.leaveTypeId,
                leaveTypeName: balance.leaveTypeName,
                totalDays: balance.used + pendingDays + rejectedDays,
                approvedDays: balance.used,
                pendingDays,
                rejectedDays,
                maxDaysPerYear: balance.maxDaysPerYear,
                remainingDays: balance.remaining,
              };
            });

            const leaveRecords = employeeYearLeaves.map((leave) => ({
              id: leave.id,
              leaveTypeName: leave.leaveType?.name || "Unknown",
              startDate: leave.startDate,
              endDate: leave.endDate,
              totalDays: this.calculateWorkingDaysInRange(
                leave.startDate,
                leave.endDate,
                startDate,
                endDate,
              ),
              status: leave.status,
              reason: leave.reason,
              appliedDate: leave.createdAt,
              approvedBy: leave.approvedBy,
              approvedDate: leave.approvedAt,
            }));

            return {
              employeeId: employee.user_id,
              employeeName: `${employee.user.first_name} ${employee.user.last_name}`,
              email: employee.user.email,
              department: employee.designation?.department?.name || "N/A",
              designation: employee.designation?.title || "N/A",
              leaveSummary,
              leaveRecords,
              totals: {
                totalLeaveDays: leaveSummary.reduce(
                  (sum, s) => sum + s.totalDays,
                  0,
                ),
                approvedLeaveDays: leaveSummary.reduce(
                  (sum, s) => sum + s.approvedDays,
                  0,
                ),
                pendingLeaveDays: leaveSummary.reduce(
                  (sum, s) => sum + s.pendingDays,
                  0,
                ),
                totalLeaveRequests: employeeYearLeaves.length,
                approvedRequests: employeeYearLeaves.filter(
                  (l) => l.status === LeaveStatus.APPROVED,
                ).length,
                pendingRequests: employeeYearLeaves.filter(
                  (l) => l.status === LeaveStatus.PENDING,
                ).length,
                rejectedRequests: employeeYearLeaves.filter(
                  (l) => l.status === LeaveStatus.REJECTED,
                ).length,
              },
            };
          },
        );

        return {
          employeeReports: {
            items: employeeReports,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
    );
  }

  async getAllLeaveReportsForExport(
    tenantId: string,
    year?: number,
    employeeName?: string,
  ): Promise<
    Array<{
      year: number;
      employee_name: string;
      email: string;
      department: string;
      designation: string;
      leave_type: string;
      start_date: string;
      end_date: string;
      total_days: number;
      status: string;
      reason: string;
      applied_date: string;
      approved_by: string;
      approved_date: string;
    }>
  > {
    const targetYear = year ?? new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    return this.runInTenantContext(
      tenantId,
      async (leaveRepo, _leaveTypeRepo, employeeRepo) => {
        const employeeQuery = employeeRepo
          .createQueryBuilder("employee")
          .leftJoinAndSelect("employee.user", "user")
          .leftJoinAndSelect("employee.designation", "designation")
          .leftJoinAndSelect("designation.department", "department")
          .where("user.tenant_id = :tenantId", { tenantId })
          .andWhere("employee.deleted_at IS NULL");

        if (employeeName?.trim()) {
          const trimmedName = employeeName.trim().replace(/\s+/g, " ");
          employeeQuery.andWhere(
            `LOWER(TRIM(CONCAT(COALESCE(user.first_name, ''), ' ', COALESCE(user.last_name, '')))) = LOWER(:name)`,
            { name: trimmedName },
          );
        }

        const allEmployees = await employeeQuery
          .orderBy("user.first_name", "ASC")
          .getMany();

        const employeeIds = allEmployees.map((e) => e.user_id);
        const leavesByEmployee: Record<string, Leave[]> = {};

        if (employeeIds.length > 0) {
          const leaves = await leaveRepo
            .createQueryBuilder("leave")
            .leftJoinAndSelect("leave.leaveType", "leaveType")
            .where("leave.employeeId IN (:...employeeIds)", { employeeIds })
            .andWhere("leave.startDate <= :endDate", { endDate })
            .andWhere("leave.endDate >= :startDate", { startDate })
            .getMany();

          leaves.forEach((leave) => {
            if (!leavesByEmployee[leave.employeeId])
              leavesByEmployee[leave.employeeId] = [];
            leavesByEmployee[leave.employeeId].push(leave);
          });
        }

        const rows: Array<{
          year: number;
          employee_name: string;
          email: string;
          department: string;
          designation: string;
          leave_type: string;
          start_date: string;
          end_date: string;
          total_days: number;
          status: string;
          reason: string;
          applied_date: string;
          approved_by: string;
          approved_date: string;
        }> = [];

        for (const employee of allEmployees) {
          const employeeYearLeaves = leavesByEmployee[employee.user_id] || [];
          const employeeNameStr =
            `${employee.user?.first_name ?? ""} ${employee.user?.last_name ?? ""}`.trim();
          const email = employee.user?.email ?? "";
          const department = employee.designation?.department?.name ?? "N/A";
          const designation = employee.designation?.title ?? "N/A";

          if (employeeYearLeaves.length === 0) {
            rows.push({
              year: targetYear,
              employee_name: employeeNameStr,
              email,
              department,
              designation,
              leave_type: "",
              start_date: "",
              end_date: "",
              total_days: 0,
              status: "",
              reason: "",
              applied_date: "",
              approved_by: "",
              approved_date: "",
            });
          } else {
            for (const leave of employeeYearLeaves) {
              rows.push({
                year: targetYear,
                employee_name: employeeNameStr,
                email,
                department,
                designation,
                leave_type: leave.leaveType?.name ?? "Unknown",
                start_date:
                  leave.startDate instanceof Date
                    ? leave.startDate.toISOString().split("T")[0]
                    : String(leave.startDate).split("T")[0],
                end_date:
                  leave.endDate instanceof Date
                    ? leave.endDate.toISOString().split("T")[0]
                    : String(leave.endDate).split("T")[0],
                total_days: this.calculateWorkingDaysInRange(
                  leave.startDate,
                  leave.endDate,
                  startDate,
                  endDate,
                ),
                status: leave.status,
                reason: leave.reason ?? "",
                applied_date: leave.createdAt
                  ? new Date(leave.createdAt).toISOString()
                  : "",
                approved_by: leave.approvedBy ?? "",
                approved_date: leave.approvedAt
                  ? new Date(leave.approvedAt).toISOString()
                  : "",
              });
            }
          }
        }

        return rows;
      },
    );
  }

  private async calculateEmployeeLeaveBalance(
    employeeId: string,
    targetYear: number,
    leaveTypes: LeaveType[],
    leaveRepo: Repository<Leave>,
    month?: number,
  ) {
    const startOfYear = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

    let monthStart: Date | undefined;
    let monthEnd: Date | undefined;
    const validMonth = month && month >= 1 && month <= 12;
    if (validMonth) {
      monthStart = new Date(Date.UTC(targetYear, month - 1, 1, 0, 0, 0, 0));
      monthEnd = new Date(Date.UTC(targetYear, month, 0, 23, 59, 59, 999));
    }

    const yearLeaves = await leaveRepo
      .createQueryBuilder("leave")
      .where("leave.employeeId = :employeeId", { employeeId })
      .andWhere("leave.status = :status", { status: LeaveStatus.APPROVED })
      .andWhere("leave.startDate <= :endOfYear", { endOfYear })
      .andWhere("leave.endDate >= :startOfYear", { startOfYear })
      .getMany();

    return leaveTypes.map((leaveType) => {
      const typeLeaves = yearLeaves.filter(
        (l) => l.leaveTypeId === leaveType.id,
      );
      const usedYear = typeLeaves.reduce(
        (total, leave) =>
          total +
          this.calculateWorkingDaysInRange(
            leave.startDate,
            leave.endDate,
            startOfYear,
            endOfYear,
          ),
        0,
      );
      let usedThisMonth = 0;
      if (validMonth && monthStart && monthEnd) {
        usedThisMonth = typeLeaves.reduce(
          (total, leave) =>
            total +
            this.calculateWorkingDaysInRange(
              leave.startDate,
              leave.endDate,
              monthStart,
              monthEnd,
            ),
          0,
        );
      }
      return {
        leaveTypeId: leaveType.id,
        leaveTypeName: leaveType.name,
        maxDaysPerYear: leaveType.maxDaysPerYear,
        used: usedYear,
        ...(validMonth ? { usedThisMonth } : {}),
        remaining: leaveType.maxDaysPerYear - usedYear,
        carryForward: leaveType.carryForward,
      };
    });
  }

  private calculateWorkingDaysInRange(
    leaveStart: Date | string,
    leaveEnd: Date | string,
    rangeStart: Date,
    rangeEnd: Date,
  ): number {
    const lStart = new Date(leaveStart);
    const lEnd = new Date(leaveEnd);
    const start = new Date(Math.max(lStart.getTime(), rangeStart.getTime()));
    const end = new Date(Math.min(lEnd.getTime(), rangeEnd.getTime()));
    if (start > end) return 0;

    let workingDays = 0;
    const current = new Date(start);
    current.setUTCHours(0, 0, 0, 0);
    const endTimestamp = end.getTime();
    while (current.getTime() <= endTimestamp) {
      const day = current.getUTCDay();
      if (day !== 0 && day !== 6) workingDays++;
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(0, 0, 0, 0);
    }
    return workingDays;
  }
}
