import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Employee } from "../../entities/employee.entity";
import { Leave } from "../../entities/leave.entity";
import { Team } from "../../entities/team.entity";
import { Attendance } from "../../entities/attendance.entity";
import { User } from "../../entities/user.entity";
import { GLOBAL_SYSTEM_TENANT_ID } from "../../common/constants/enums";
import {
  SearchModule,
  SearchResultItem,
  GlobalSearchResponseDto,
} from "./dto/search.dto";
import { RolesPermissionsService } from "../../common/services/roles-permissions.service";

const MODULE_READ_PERMISSION: Record<
  Exclude<SearchModule, SearchModule.ALL>,
  string
> = {
  [SearchModule.EMPLOYEES]: "employee.read",
  [SearchModule.LEAVES]: "leave.read",
  [SearchModule.TEAMS]: "team.read",
  [SearchModule.ATTENDANCE]: "attendance.read",
};

const ALL_MODULES = Object.keys(MODULE_READ_PERMISSION) as Exclude<
  SearchModule,
  SearchModule.ALL
>[];

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Leave)
    private readonly leaveRepository: Repository<Leave>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly rolesPermissions: RolesPermissionsService,
  ) {}

  buildEmptyResponse(query: string): GlobalSearchResponseDto {
    const results: GlobalSearchResponseDto["results"] = {
      employees: [],
      leaves: [],
      teams: [],
      attendance: [],
    };
    const counts = {
      employees: 0,
      leaves: 0,
      teams: 0,
      attendance: 0,
    };
    return { query, totalResults: 0, results, counts };
  }

  async globalSearch(
    query: string | undefined,
    tenantId: string,
    userRole: string,
    module: SearchModule = SearchModule.ALL,
    limit: number = 10,
    currentUserId?: string,
    currentUserEmail?: string,
    teamIds?: string[],
  ): Promise<GlobalSearchResponseDto> {
    this.logger.log(
      `Global search: query="${query}", tenantId="${tenantId}", role="${userRole}", module="${module}"`,
    );

    const isAdminRole =
      userRole === "system-admin" || userRole === "network-admin";
    const searchAllTenants =
      isAdminRole && tenantId === GLOBAL_SYSTEM_TENANT_ID;
    const searchTerm = query ? `%${query}%` : "%";

    const allowedModules = this.getAllowedModules(userRole, module);
    const results: GlobalSearchResponseDto["results"] = {};
    const counts = {
      employees: 0,
      leaves: 0,
      teams: 0,
      attendance: 0,
    };

    if (module === SearchModule.ALL || module === SearchModule.EMPLOYEES) {
      if (allowedModules.includes(SearchModule.EMPLOYEES)) {
        const r = await this.searchEmployees(
          searchTerm,
          tenantId,
          searchAllTenants,
          limit,
          currentUserId,
          currentUserEmail,
          teamIds,
        );
        results.employees = r.items;
        counts.employees = r.total;
      }
    }
    if (module === SearchModule.ALL || module === SearchModule.LEAVES) {
      if (allowedModules.includes(SearchModule.LEAVES)) {
        const r = await this.searchLeaves(
          searchTerm,
          tenantId,
          searchAllTenants,
          limit,
          teamIds,
        );
        results.leaves = r.items;
        counts.leaves = r.total;
      }
    }
    if (module === SearchModule.ALL || module === SearchModule.TEAMS) {
      if (allowedModules.includes(SearchModule.TEAMS)) {
        const r = await this.searchTeams(
          searchTerm,
          tenantId,
          searchAllTenants,
          limit,
        );
        results.teams = r.items;
        counts.teams = r.total;
      }
    }
    if (module === SearchModule.ALL || module === SearchModule.ATTENDANCE) {
      if (allowedModules.includes(SearchModule.ATTENDANCE)) {
        const r = await this.searchAttendance(
          searchTerm,
          tenantId,
          searchAllTenants,
          limit,
          teamIds,
        );
        results.attendance = r.items;
        counts.attendance = r.total;
      }
    }

    const totalResults = Object.values(counts).reduce((s, c) => s + c, 0);
    return {
      query: query ?? "",
      totalResults,
      results,
      counts,
    };
  }

  private getAllowedModules(
    userRole: string,
    requestedModule: SearchModule,
  ): Exclude<SearchModule, SearchModule.ALL>[] {
    const role = userRole.toLowerCase();
    if (requestedModule !== SearchModule.ALL) {
      const perm =
        MODULE_READ_PERMISSION[
          requestedModule as Exclude<SearchModule, SearchModule.ALL>
        ];
      return perm && this.rolesPermissions.hasPermission(role, perm)
        ? [requestedModule as Exclude<SearchModule, SearchModule.ALL>]
        : [];
    }
    return ALL_MODULES.filter((m) =>
      this.rolesPermissions.hasPermission(role, MODULE_READ_PERMISSION[m]),
    );
  }

  private async searchEmployees(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
    currentUserId?: string,
    currentUserEmail?: string,
    teamIds?: string[],
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.employeeRepository
      .createQueryBuilder("employee")
      .leftJoinAndSelect("employee.user", "user")
      .leftJoinAndSelect("employee.designation", "designation")
      .leftJoinAndSelect("employee.team", "team")
      .where(
        `(
          user.first_name ILIKE :searchTerm OR
          user.last_name ILIKE :searchTerm OR
          CONCAT(user.first_name, ' ', user.last_name) ILIKE :searchTerm OR
          user.email ILIKE :searchTerm OR
          user.phone ILIKE :searchTerm OR
          employee.cnic_number ILIKE :searchTerm
        )`,
        { searchTerm },
      );

    if (!searchAllTenants) {
      queryBuilder.andWhere("user.tenant_id = :tenantId", { tenantId });
    }

    if (teamIds && teamIds.length > 0) {
      queryBuilder.andWhere("employee.team_id IN (:...teamIds)", { teamIds });
    }

    const [employees, total] = await queryBuilder
      .take(limit)
      .getManyAndCount();

    let finalEmployees = [...employees];
    if (currentUserId && searchTerm !== "%") {
      const searchLower = searchTerm.replace(/%/g, "").toLowerCase().trim();
      const currentUserEmployee = await this.employeeRepository.findOne({
        where: { user_id: currentUserId },
        relations: ["user", "designation", "designation.department", "team"],
      });

      if (currentUserEmployee) {
        const empUserEmail = currentUserEmployee.user.email.toLowerCase().trim();
        const currentUserInResults = employees.some(
          (emp) => emp.user_id === currentUserId,
        );
        const isExactEmailMatch =
          currentUserEmail &&
          searchLower === currentUserEmail.toLowerCase().trim();
        const isPartialEmailMatch =
          currentUserEmail &&
          currentUserEmail.toLowerCase().includes(searchLower);
        const isEmployeeEmailMatch =
          empUserEmail === searchLower || empUserEmail.includes(searchLower);
        const fullName = `${currentUserEmployee.user.first_name} ${currentUserEmployee.user.last_name}`.toLowerCase();
        const matchesSearchTerm =
          isExactEmailMatch ||
          isPartialEmailMatch ||
          isEmployeeEmailMatch ||
          currentUserEmployee.user.first_name
            .toLowerCase()
            .includes(searchLower) ||
          currentUserEmployee.user.last_name
            .toLowerCase()
            .includes(searchLower) ||
          fullName.includes(searchLower) ||
          currentUserEmployee.user.phone
            ?.toLowerCase()
            .includes(searchLower) ||
          currentUserEmployee.cnic_number
            ?.toLowerCase()
            .includes(searchLower);

        if (matchesSearchTerm) {
          if (!currentUserInResults) {
            finalEmployees.unshift(currentUserEmployee);
          } else {
            const currentUserIndex = finalEmployees.findIndex(
              (emp) => emp.user_id === currentUserId,
            );
            if (currentUserIndex > 0) {
              const [currentUserEmp] = finalEmployees.splice(
                currentUserIndex,
                1,
              );
              finalEmployees.unshift(currentUserEmp);
            }
          }
        }
      } else if (currentUserEmail && searchLower) {
        const userEmailLower = currentUserEmail.toLowerCase().trim();
        const isExactEmailMatch = userEmailLower === searchLower;
        const isPartialEmailMatch = userEmailLower.includes(searchLower);
        if (isExactEmailMatch || isPartialEmailMatch) {
          const currentUser = await this.userRepository.findOne({
            where: { id: currentUserId },
            relations: ["role"],
          });
          if (currentUser) {
            const pseudoEmployee = {
              id: currentUser.id,
              user_id: currentUser.id,
              user: currentUser,
              designation: null,
              team: null,
              cnic_number: null,
              status: null,
            } as unknown as Employee;
            finalEmployees.unshift(pseudoEmployee);
          }
        }
      }
    }

    const items: SearchResultItem[] = finalEmployees.map((emp) => {
      const roleName = emp.user?.role?.name || "N/A";
      const designationTitle = emp.designation?.title || roleName;
      const teamName = emp.team?.name || "No Team";
      return {
        id: emp.id,
        title: `${emp.user.first_name} ${emp.user.last_name}`,
        description: `${emp.user.email} | ${designationTitle} | ${teamName}`,
        module: "employees",
        metadata: {
          employeeId: emp.id,
          userId: emp.user_id,
          email: emp.user.email,
          phone: emp.user.phone,
          profilePic: emp.user.profile_pic || null,
          designation: designationTitle,
          team: teamName !== "No Team" ? teamName : null,
          status: emp.status || "active",
          cnic: emp.cnic_number || null,
        },
      };
    });

    const adjustedTotal =
      finalEmployees.length > employees.length
        ? total + (finalEmployees.length - employees.length)
        : total;

    return { items, total: adjustedTotal };
  }

  private async searchLeaves(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
    teamIds?: string[],
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.leaveRepository
      .createQueryBuilder("leave")
      .leftJoinAndSelect("leave.employee", "employee")
      .leftJoinAndSelect("leave.leaveType", "leaveType")
      .leftJoinAndSelect("leave.approver", "approver")
      .where(
        `(
          employee.first_name ILIKE :searchTerm OR
          employee.last_name ILIKE :searchTerm OR
          CONCAT(employee.first_name, ' ', employee.last_name) ILIKE :searchTerm OR
          leaveType.name ILIKE :searchTerm OR
          leave.reason ILIKE :searchTerm OR
          leave.status ILIKE :searchTerm OR
          leave.remarks ILIKE :searchTerm OR
          leave.managerRemarks ILIKE :searchTerm
        )`,
        { searchTerm },
      );

    if (!searchAllTenants) {
      queryBuilder.andWhere("leave.tenantId = :tenantId", { tenantId });
    }

    if (teamIds && teamIds.length > 0) {
      const teamEmployees = await this.employeeRepository.find({
        where: { team_id: In(teamIds) },
        select: ["user_id"],
      });
      if (teamEmployees.length > 0) {
        const userIds = teamEmployees.map((emp) => emp.user_id);
        queryBuilder.andWhere("leave.employeeId IN (:...userIds)", { userIds });
      } else {
        queryBuilder.andWhere("1 = 0");
      }
    }

    const [leaves, total] = await queryBuilder
      .orderBy("leave.createdAt", "DESC")
      .take(limit)
      .getManyAndCount();

    const userIds = [...new Set(leaves.map((l) => l.employeeId))];
    const employees =
      userIds.length > 0
        ? await this.employeeRepository.find({
            where: userIds.map((userId) => ({ user_id: userId })),
            select: ["id", "user_id"],
          })
        : [];
    const userToEmployeeMap = new Map(employees.map((emp) => [emp.user_id, emp.id]));

    const items: SearchResultItem[] = leaves.map((leave) => {
      const employeeId = userToEmployeeMap.get(leave.employeeId);
      return {
        id: leave.id,
        title: `${leave.employee.first_name} ${leave.employee.last_name} - ${leave.leaveType.name}`,
        description: `${leave.reason.substring(0, 100)}${leave.reason.length > 100 ? "..." : ""} | Status: ${leave.status} | ${leave.totalDays} days`,
        module: "leaves",
        metadata: {
          leaveId: leave.id,
          employeeId: employeeId || null,
          userId: leave.employeeId,
          employeeName: `${leave.employee.first_name} ${leave.employee.last_name}`,
          leaveType: leave.leaveType.name,
          startDate: leave.startDate,
          endDate: leave.endDate,
          totalDays: leave.totalDays,
          status: leave.status,
          reason: leave.reason,
          approver: leave.approver
            ? `${leave.approver.first_name} ${leave.approver.last_name}`
            : null,
        },
      };
    });

    return { items, total };
  }

  private async searchTeams(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.teamRepository
      .createQueryBuilder("team")
      .leftJoinAndSelect("team.manager", "manager")
      .leftJoinAndSelect("team.teamMembers", "teamMembers")
      .leftJoinAndSelect("teamMembers.user", "memberUser")
      .where(
        `(
          team.name ILIKE :searchTerm OR
          team.description ILIKE :searchTerm OR
          manager.first_name ILIKE :searchTerm OR
          manager.last_name ILIKE :searchTerm OR
          CONCAT(manager.first_name, ' ', manager.last_name) ILIKE :searchTerm OR
          manager.email ILIKE :searchTerm
        )`,
        { searchTerm },
      );

    if (!searchAllTenants) {
      queryBuilder.andWhere("manager.tenant_id = :tenantId", { tenantId });
    }

    const [teams, total] = await queryBuilder
      .orderBy("team.created_at", "DESC")
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = teams.map((team) => ({
      id: team.id,
      title: team.name,
      description: `${team.description || "No description"} | Manager: ${team.manager.first_name} ${team.manager.last_name} | Members: ${team.teamMembers?.length || 0}`,
      module: "teams",
      metadata: {
        name: team.name,
        description: team.description,
        managerName: `${team.manager.first_name} ${team.manager.last_name}`,
        managerEmail: team.manager.email,
        memberCount: team.teamMembers?.length || 0,
        createdAt: team.created_at,
      },
    }));

    return { items, total };
  }

  private async searchAttendance(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
    teamIds?: string[],
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.attendanceRepository
      .createQueryBuilder("attendance")
      .leftJoinAndSelect("attendance.user", "user")
      .where(
        `(
          user.first_name ILIKE :searchTerm OR
          user.last_name ILIKE :searchTerm OR
          CONCAT(user.first_name, ' ', user.last_name) ILIKE :searchTerm OR
          user.email ILIKE :searchTerm OR
          attendance.type ILIKE :searchTerm
        )`,
        { searchTerm },
      );

    if (!searchAllTenants) {
      queryBuilder.andWhere("user.tenant_id = :tenantId", { tenantId });
    }

    if (teamIds && teamIds.length > 0) {
      const teamEmployees = await this.employeeRepository.find({
        where: { team_id: In(teamIds) },
        select: ["user_id"],
      });
      if (teamEmployees.length > 0) {
        const userIds = teamEmployees.map((emp) => emp.user_id);
        queryBuilder.andWhere("attendance.user_id IN (:...userIds)", {
          userIds,
        });
      } else {
        queryBuilder.andWhere("1 = 0");
      }
    }

    const [attendances, total] = await queryBuilder
      .orderBy("attendance.timestamp", "DESC")
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = attendances.map((attendance) => ({
      id: attendance.id,
      title: `${attendance.user.first_name} ${attendance.user.last_name} - ${attendance.type}`,
      description: `${attendance.type} | ${attendance.timestamp.toLocaleString()}`,
      module: "attendance",
      metadata: {
        userName: `${attendance.user.first_name} ${attendance.user.last_name}`,
        userEmail: attendance.user.email,
        type: attendance.type,
        timestamp: attendance.timestamp,
        createdAt: attendance.created_at,
      },
    }));

    return { items, total };
  }
}
