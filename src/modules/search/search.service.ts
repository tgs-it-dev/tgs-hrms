import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { Leave } from '../../entities/leave.entity';
import { Asset } from '../../entities/asset.entity';
import { AssetRequest } from '../../entities/asset-request.entity';
import { Team } from '../../entities/team.entity';
import { Attendance } from '../../entities/attendance.entity';
import { EmployeeBenefit } from '../../entities/employee-benefit.entity';
import { PayrollRecord } from '../../entities/payroll-record.entity';
import { User } from '../../entities/user.entity';
import { GLOBAL_SYSTEM_TENANT_ID } from '../../common/constants/enums';
import { SearchModule, SearchResultItem, GlobalSearchResponseDto } from './dto/search.dto';
import { RolesPermissionsService } from '../../common/services/roles-permissions.service';

/** RBAC: each search module requires this permission to be included in search results */
const MODULE_READ_PERMISSION: Record<Exclude<SearchModule, SearchModule.ALL>, string> = {
  [SearchModule.EMPLOYEES]: 'employee.read',
  [SearchModule.LEAVES]: 'leave.read',
  [SearchModule.ASSETS]: 'asset.read',
  [SearchModule.ASSET_REQUESTS]: 'asset-request.read',
  [SearchModule.TEAMS]: 'team.read',
  [SearchModule.ATTENDANCE]: 'attendance.read',
  [SearchModule.BENEFITS]: 'employee.read',
  [SearchModule.PAYROLL]: 'employee.read',
};

const ALL_MODULES = Object.keys(MODULE_READ_PERMISSION) as Exclude<SearchModule, SearchModule.ALL>[];

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Leave)
    private readonly leaveRepository: Repository<Leave>,
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(AssetRequest)
    private readonly assetRequestRepository: Repository<AssetRequest>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(EmployeeBenefit)
    private readonly employeeBenefitRepository: Repository<EmployeeBenefit>,
    @InjectRepository(PayrollRecord)
    private readonly payrollRecordRepository: Repository<PayrollRecord>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly rolesPermissions: RolesPermissionsService,
  ) {}

  /**
   * Returns empty search response (e.g. for manager with no teams).
   */
  buildEmptyResponse(query: string): GlobalSearchResponseDto {
    const results: GlobalSearchResponseDto['results'] = {
      employees: [],
      leaves: [],
      assets: [],
      assetRequests: [],
      teams: [],
      attendance: [],
      benefits: [],
      payroll: [],
    };
    const counts = {
      employees: 0,
      leaves: 0,
      assets: 0,
      assetRequests: 0,
      teams: 0,
      attendance: 0,
      benefits: 0,
      payroll: 0,
    };
    return { query, totalResults: 0, results, counts };
  }

  /**
   * Global search: tenant-scoped and RBAC-filtered.
   * Only modules the user has read permission for are searched and returned.
   */
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
      userRole === 'system-admin' || userRole === 'network-admin';
    const searchAllTenants = isAdminRole && tenantId === GLOBAL_SYSTEM_TENANT_ID;
    const searchTerm = query ? `%${query}%` : '%';

    const allowedModules = this.getAllowedModules(userRole, module);
    const results: GlobalSearchResponseDto['results'] = {};
    const counts = {
      employees: 0,
      leaves: 0,
      assets: 0,
      assetRequests: 0,
      teams: 0,
      attendance: 0,
      benefits: 0,
      payroll: 0,
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
    if (module === SearchModule.ALL || module === SearchModule.ASSETS) {
      if (allowedModules.includes(SearchModule.ASSETS)) {
        const r = await this.searchAssets(
          searchTerm,
          tenantId,
          searchAllTenants,
          limit,
        );
        results.assets = r.items;
        counts.assets = r.total;
      }
    }
    if (module === SearchModule.ALL || module === SearchModule.ASSET_REQUESTS) {
      if (allowedModules.includes(SearchModule.ASSET_REQUESTS)) {
        const r = await this.searchAssetRequests(
          searchTerm,
          tenantId,
          searchAllTenants,
          limit,
          teamIds,
        );
        results.assetRequests = r.items;
        counts.assetRequests = r.total;
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
    if (module === SearchModule.ALL || module === SearchModule.BENEFITS) {
      if (allowedModules.includes(SearchModule.BENEFITS)) {
        const r = await this.searchBenefits(
          searchTerm,
          tenantId,
          searchAllTenants,
          limit,
          teamIds,
        );
        results.benefits = r.items;
        counts.benefits = r.total;
      }
    }
    if (module === SearchModule.ALL || module === SearchModule.PAYROLL) {
      if (allowedModules.includes(SearchModule.PAYROLL)) {
        const r = await this.searchPayroll(
          searchTerm,
          tenantId,
          searchAllTenants,
          limit,
          teamIds,
        );
        results.payroll = r.items;
        counts.payroll = r.total;
      }
    }

    const totalResults = Object.values(counts).reduce((s, c) => s + c, 0);
    return {
      query: query ?? '',
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
      const perm = MODULE_READ_PERMISSION[requestedModule as Exclude<SearchModule, SearchModule.ALL>];
      return perm && this.rolesPermissions.hasPermission(role, perm)
        ? [requestedModule as Exclude<SearchModule, SearchModule.ALL>]
        : [];
    }
    return ALL_MODULES.filter((m) =>
      this.rolesPermissions.hasPermission(role, MODULE_READ_PERMISSION[m]),
    );
  }

  /**
   * Search employees by name, email, phone, CNIC
   */
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
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('employee.team', 'team')
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

    // Apply tenant filter (skip if searching all tenants)
    if (!searchAllTenants) {
      queryBuilder.andWhere('user.tenant_id = :tenantId', { tenantId });
    }

    // Apply team filter for manager role - only show employees in manager's team(s)
    if (teamIds && teamIds.length > 0) {
      queryBuilder.andWhere('employee.team_id IN (:...teamIds)', { teamIds });
    }

    const [employees, total] = await queryBuilder
      .take(limit)
      .getManyAndCount();

    // Ensure current user's data is included and prioritized if they match the search term
    let finalEmployees = [...employees];
    if (currentUserId && searchTerm !== '%') {
      const searchLower = searchTerm.replace(/%/g, '').toLowerCase().trim();
      const currentUserEmployee = await this.employeeRepository.findOne({
        where: { user_id: currentUserId },
        relations: ['user', 'designation', 'designation.department', 'team'],
      });

      if (currentUserEmployee) {
        const empUserEmail = currentUserEmployee.user.email.toLowerCase().trim();
        const currentUserInResults = employees.some(emp => emp.user_id === currentUserId);

        // Check if search term matches current user's email exactly or partially
        const isExactEmailMatch = currentUserEmail && searchLower === currentUserEmail.toLowerCase().trim();
        const isPartialEmailMatch = currentUserEmail && currentUserEmail.toLowerCase().includes(searchLower);
        const isEmployeeEmailMatch = empUserEmail === searchLower || empUserEmail.includes(searchLower);

        // Check if current user matches search term by other fields
        const fullName = `${currentUserEmployee.user.first_name} ${currentUserEmployee.user.last_name}`.toLowerCase();
        const matchesSearchTerm =
          isExactEmailMatch ||
          isPartialEmailMatch ||
          isEmployeeEmailMatch ||
          currentUserEmployee.user.first_name.toLowerCase().includes(searchLower) ||
          currentUserEmployee.user.last_name.toLowerCase().includes(searchLower) ||
          fullName.includes(searchLower) ||
          currentUserEmployee.user.phone?.toLowerCase().includes(searchLower) ||
          currentUserEmployee.cnic_number?.toLowerCase().includes(searchLower);

        // If current user matches search term (especially by email), ensure they're in results and prioritized
        if (matchesSearchTerm) {
          if (!currentUserInResults) {
            // Add current user to results if they match but weren't found
            // Always add at the top, especially for exact email matches
            finalEmployees.unshift(currentUserEmployee);
          } else {
            // If current user is already in results, prioritize them by moving to top
            // This ensures when HR admin searches by their own email, their data appears first
            const currentUserIndex = finalEmployees.findIndex(emp => emp.user_id === currentUserId);
            if (currentUserIndex >= 0 && currentUserIndex > 0) {
              const [currentUserEmp] = finalEmployees.splice(currentUserIndex, 1);
              finalEmployees.unshift(currentUserEmp);
            } else if (isExactEmailMatch && currentUserIndex === 0) {
              // Already at top, but ensure it stays there for exact matches
              // No action needed
            }
          }
        }
      } else if (currentUserEmail && searchLower) {
        // If employee record doesn't exist, check if user email matches search term
        // This handles cases where HR admin might not have an employee record yet
        const userEmailLower = currentUserEmail.toLowerCase().trim();
        const isExactEmailMatch = userEmailLower === searchLower;
        const isPartialEmailMatch = userEmailLower.includes(searchLower);

        if (isExactEmailMatch || isPartialEmailMatch) {
          // Fetch user data to create a result
          const currentUser = await this.userRepository.findOne({
            where: { id: currentUserId },
            relations: ['role'],
          });

          if (currentUser) {
            // Create a pseudo-employee object with user data so it can be processed like other employees
            const pseudoEmployee = {
              id: currentUser.id, // Use user ID as employee ID
              user_id: currentUser.id,
              user: currentUser,
              designation: null,
              team: null,
              cnic_number: null,
              // profile_picture: null,
              status: null,
            } as any;

            // Add to results at the top
            finalEmployees.unshift(pseudoEmployee);
          }
        }
      }
    }

    const items: SearchResultItem[] = finalEmployees.map((emp) => {
      // Handle case where user might not have employee record (e.g., HR admin without employee record)
      const roleName = emp.user?.role?.name || 'N/A';
      const designationTitle = emp.designation?.title || roleName;
      const teamName = emp.team?.name || 'No Team';

      return {
        id: emp.id,
        title: `${emp.user.first_name} ${emp.user.last_name}`,
        description: `${emp.user.email} | ${designationTitle} | ${teamName}`,
        module: 'employees',
        metadata: {
          employeeId: emp.id,
          userId: emp.user_id,
          email: emp.user.email,
          phone: emp.user.phone,
          profilePic: emp.user.profile_pic || null,
          designation: designationTitle,
          team: teamName !== 'No Team' ? teamName : null,
          status: emp.status || 'active',
          cnic: emp.cnic_number || null,
        },
      };
    });

    // Update total count if we added the current user to results
    const adjustedTotal = finalEmployees.length > employees.length
      ? total + (finalEmployees.length - employees.length)
      : total;

    return { items, total: adjustedTotal };
  }

  /**
   * Search leaves by employee name, leave type, reason, status
   */
  private async searchLeaves(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
    teamIds?: string[],
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.leaveRepository
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'employee')
      .leftJoinAndSelect('leave.leaveType', 'leaveType')
      .leftJoinAndSelect('leave.approver', 'approver')
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

    // Apply tenant filter (skip if searching all tenants)
    if (!searchAllTenants) {
      queryBuilder.andWhere('leave.tenantId = :tenantId', { tenantId });
    }

    // Apply team filter for manager role - only show leaves of employees in manager's team(s)
    if (teamIds && teamIds.length > 0) {
      // Get user IDs of employees in the manager's team(s)
      const teamEmployees = await this.employeeRepository.find({
        where: { team_id: In(teamIds) },
        select: ['user_id'],
      });

      if (teamEmployees.length > 0) {
        const userIds = teamEmployees.map(emp => emp.user_id);
        queryBuilder.andWhere('leave.employeeId IN (:...userIds)', { userIds });
      } else {
        // If no employees in team, return no results
        queryBuilder.andWhere('1 = 0');
      }
    }

    const [leaves, total] = await queryBuilder
      .orderBy('leave.createdAt', 'DESC')
      .take(limit)
      .getManyAndCount();

    // Get employee IDs for all leaves (employeeId in Leave is actually userId)
    const userIds = [...new Set(leaves.map(l => l.employeeId))];
    const employees = userIds.length > 0
      ? await this.employeeRepository.find({
        where: userIds.map(userId => ({ user_id: userId })),
        select: ['id', 'user_id'],
      })
      : [];
    const userToEmployeeMap = new Map(employees.map(emp => [emp.user_id, emp.id]));

    const items: SearchResultItem[] = leaves.map((leave) => {
      const employeeId = userToEmployeeMap.get(leave.employeeId);
      return {
        id: leave.id,
        title: `${leave.employee.first_name} ${leave.employee.last_name} - ${leave.leaveType.name}`,
        description: `${leave.reason.substring(0, 100)}${leave.reason.length > 100 ? '...' : ''} | Status: ${leave.status} | ${leave.totalDays} days`,
        module: 'leaves',
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
          approver: leave.approver ? `${leave.approver.first_name} ${leave.approver.last_name}` : null,
        },
      };
    });

    return { items, total };
  }

  /**
   * Search assets by name, category, subcategory, status
   */
  private async searchAssets(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.category', 'category')
      .leftJoinAndSelect('asset.subcategory', 'subcategory')
      .leftJoinAndSelect('asset.assignedToUser', 'assignedUser')
      .where(
        `(
          asset.name ILIKE :searchTerm OR
          category.name ILIKE :searchTerm OR
          subcategory.name ILIKE :searchTerm OR
          asset.status ILIKE :searchTerm
        )`,
        { searchTerm },
      );

    // Apply tenant filter (skip if searching all tenants)
    if (!searchAllTenants) {
      queryBuilder.andWhere('asset.tenant_id = :tenantId', { tenantId });
    }

    const [assets, total] = await queryBuilder
      .orderBy('asset.created_at', 'DESC')
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = assets.map((asset) => ({
      id: asset.id,
      title: asset.name,
      description: `${asset.category?.name || 'No Category'} | ${asset.subcategory?.name || 'No Subcategory'} | Status: ${asset.status}${asset.assignedToUser ? ` | Assigned to: ${asset.assignedToUser.first_name} ${asset.assignedToUser.last_name}` : ''}`,
      module: 'assets',
      metadata: {
        name: asset.name,
        category: asset.category?.name,
        subcategory: asset.subcategory?.name,
        status: asset.status,
        assignedTo: asset.assignedToUser ? `${asset.assignedToUser.first_name} ${asset.assignedToUser.last_name}` : null,
        purchaseDate: asset.purchase_date,
      },
    }));

    return { items, total };
  }

  /**
   * Search asset requests by requester name, category, subcategory, status
   */
  private async searchAssetRequests(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
    teamIds?: string[],
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.assetRequestRepository
      .createQueryBuilder('assetRequest')
      .leftJoinAndSelect('assetRequest.requestedByUser', 'requester')
      .leftJoinAndSelect('assetRequest.category', 'category')
      .leftJoinAndSelect('assetRequest.subcategory', 'subcategory')
      .leftJoinAndSelect('assetRequest.approvedByUser', 'approver')
      .where(
        `(
          requester.first_name ILIKE :searchTerm OR
          requester.last_name ILIKE :searchTerm OR
          CONCAT(requester.first_name, ' ', requester.last_name) ILIKE :searchTerm OR
          category.name ILIKE :searchTerm OR
          subcategory.name ILIKE :searchTerm OR
          assetRequest.status ILIKE :searchTerm OR
          assetRequest.remarks ILIKE :searchTerm OR
          assetRequest.rejection_reason ILIKE :searchTerm
        )`,
        { searchTerm },
      );

    // Apply tenant filter (skip if searching all tenants)
    if (!searchAllTenants) {
      queryBuilder.andWhere('assetRequest.tenant_id = :tenantId', { tenantId });
    }

    // Apply team filter for manager role - only show asset requests of employees in manager's team(s)
    if (teamIds && teamIds.length > 0) {
      // Get user IDs of employees in the manager's team(s)
      const teamEmployees = await this.employeeRepository.find({
        where: { team_id: In(teamIds) },
        select: ['user_id'],
      });

      if (teamEmployees.length > 0) {
        const userIds = teamEmployees.map(emp => emp.user_id);
        queryBuilder.andWhere('assetRequest.requested_by IN (:...userIds)', { userIds });
      } else {
        // If no employees in team, return no results
        queryBuilder.andWhere('1 = 0');
      }
    }

    const [assetRequests, total] = await queryBuilder
      .orderBy('assetRequest.created_at', 'DESC')
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = assetRequests.map((request) => {
      const requesterName = request.requestedByUser
        ? `${request.requestedByUser.first_name} ${request.requestedByUser.last_name}`
        : 'Unknown User';
      const categoryName = request.category?.name || 'Unknown Category';

      return {
        id: request.id,
        title: `${requesterName} - ${categoryName}`,
        description: `${categoryName}${request.subcategory ? ` | ${request.subcategory.name}` : ''} | Status: ${request.status} | Requested: ${request.requested_date}`,
        module: 'asset-requests',
        metadata: {
          requesterName,
          category: categoryName,
          subcategory: request.subcategory?.name,
          status: request.status,
          requestedDate: request.requested_date,
          approvedDate: request.approved_date,
          approver: request.approvedByUser ? `${request.approvedByUser.first_name} ${request.approvedByUser.last_name}` : null,
          remarks: request.remarks,
          rejectionReason: request.rejection_reason,
        },
      };
    });

    return { items, total };
  }

  /**
   * Search teams by name, description, manager name
   */
  private async searchTeams(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.teamRepository
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.manager', 'manager')
      .leftJoinAndSelect('team.teamMembers', 'teamMembers')
      .leftJoinAndSelect('teamMembers.user', 'memberUser')
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

    // Apply tenant filter via manager's tenant_id (skip if searching all tenants)
    if (!searchAllTenants) {
      queryBuilder.andWhere('manager.tenant_id = :tenantId', { tenantId });
    }

    const [teams, total] = await queryBuilder
      .orderBy('team.created_at', 'DESC')
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = teams.map((team) => ({
      id: team.id,
      title: team.name,
      description: `${team.description || 'No description'} | Manager: ${team.manager.first_name} ${team.manager.last_name} | Members: ${team.teamMembers?.length || 0}`,
      module: 'teams',
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

  /**
   * Search attendance by user name, email, type, timestamp
   */
  private async searchAttendance(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
    teamIds?: string[],
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.user', 'user')
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

    // Apply tenant filter via user's tenant_id (skip if searching all tenants)
    if (!searchAllTenants) {
      queryBuilder.andWhere('user.tenant_id = :tenantId', { tenantId });
    }

    // Apply team filter for manager role - only show attendance of employees in manager's team(s)
    if (teamIds && teamIds.length > 0) {
      // Get user IDs of employees in the manager's team(s)
      const teamEmployees = await this.employeeRepository.find({
        where: { team_id: In(teamIds) },
        select: ['user_id'],
      });

      if (teamEmployees.length > 0) {
        const userIds = teamEmployees.map(emp => emp.user_id);
        queryBuilder.andWhere('attendance.user_id IN (:...userIds)', { userIds });
      } else {
        // If no employees in team, return no results
        queryBuilder.andWhere('1 = 0');
      }
    }

    const [attendances, total] = await queryBuilder
      .orderBy('attendance.timestamp', 'DESC')
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = attendances.map((attendance) => ({
      id: attendance.id,
      title: `${attendance.user.first_name} ${attendance.user.last_name} - ${attendance.type}`,
      description: `${attendance.type} | ${attendance.timestamp.toLocaleString()}`,
      module: 'attendance',
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

  /**
   * Search employee benefits by employee name, benefit name, type, status
   */
  private async searchBenefits(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
    teamIds?: string[],
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.employeeBenefitRepository
      .createQueryBuilder('employeeBenefit')
      .leftJoinAndSelect('employeeBenefit.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employeeBenefit.benefit', 'benefit')
      .where(
        `(
          user.first_name ILIKE :searchTerm OR
          user.last_name ILIKE :searchTerm OR
          CONCAT(user.first_name, ' ', user.last_name) ILIKE :searchTerm OR
          user.email ILIKE :searchTerm OR
          benefit.name ILIKE :searchTerm OR
          benefit.type ILIKE :searchTerm OR
          benefit.description ILIKE :searchTerm OR
          employeeBenefit.status ILIKE :searchTerm
        )`,
        { searchTerm },
      );

    // Apply tenant filter (skip if searching all tenants)
    if (!searchAllTenants) {
      queryBuilder.andWhere('employeeBenefit.tenant_id = :tenantId', { tenantId });
    }

    // Apply team filter for manager role - only show benefits of employees in manager's team(s)
    if (teamIds && teamIds.length > 0) {
      queryBuilder.andWhere('employee.team_id IN (:...teamIds)', { teamIds });
    }

    const [employeeBenefits, total] = await queryBuilder
      .orderBy('employeeBenefit.createdAt', 'DESC')
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = employeeBenefits.map((eb) => {
      const startDate = eb.startDate instanceof Date
        ? eb.startDate.toLocaleDateString()
        : new Date(eb.startDate).toLocaleDateString();
      const endDate = eb.endDate
        ? (eb.endDate instanceof Date
          ? eb.endDate.toLocaleDateString()
          : new Date(eb.endDate).toLocaleDateString())
        : null;

      return {
        id: eb.id,
        title: `${eb.employee.user.first_name} ${eb.employee.user.last_name} - ${eb.benefit.name}`,
        description: `${eb.benefit.type} | Status: ${eb.status} | Start: ${startDate}${endDate ? ` | End: ${endDate}` : ''}`,
        module: 'benefits',
        metadata: {
          benefitAssignmentId: eb.id,
          employeeId: eb.employee.id,
          userId: eb.employee.user_id,
          employeeName: `${eb.employee.user.first_name} ${eb.employee.user.last_name}`,
          employeeEmail: eb.employee.user.email,
          profilePic: eb.employee.user.profile_pic || null,
          benefitName: eb.benefit.name,
          benefitType: eb.benefit.type,
          status: eb.status,
          startDate: eb.startDate,
          endDate: eb.endDate,
        },
      };
    });

    return { items, total };
  }

  /**
   * Search payroll records by employee name, month, year, status
   */
  private async searchPayroll(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
    teamIds?: string[],
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const queryBuilder = this.payrollRecordRepository
      .createQueryBuilder('payroll')
      .leftJoinAndSelect('payroll.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('payroll.generatedBy', 'generatedBy')
      .leftJoinAndSelect('payroll.approvedBy', 'approvedBy')
      .where(
        `(
          user.first_name ILIKE :searchTerm OR
          user.last_name ILIKE :searchTerm OR
          CONCAT(user.first_name, ' ', user.last_name) ILIKE :searchTerm OR
          user.email ILIKE :searchTerm OR
          payroll.status ILIKE :searchTerm OR
          CAST(payroll.month AS TEXT) ILIKE :searchTerm OR
          CAST(payroll.year AS TEXT) ILIKE :searchTerm
        )`,
        { searchTerm },
      );

    // Apply tenant filter (skip if searching all tenants)
    if (!searchAllTenants) {
      queryBuilder.andWhere('payroll.tenant_id = :tenantId', { tenantId });
    }

    // Apply team filter for manager role - only show payroll of employees in manager's team(s)
    if (teamIds && teamIds.length > 0) {
      queryBuilder.andWhere('employee.team_id IN (:...teamIds)', { teamIds });
    }

    const [payrollRecords, total] = await queryBuilder
      .orderBy('payroll.year', 'DESC')
      .addOrderBy('payroll.month', 'DESC')
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = payrollRecords.map((payroll) => ({
      id: payroll.id,
      title: `${payroll.employee.user.first_name} ${payroll.employee.user.last_name} - ${payroll.month}/${payroll.year}`,
      description: `Net Salary: ${payroll.netSalary} | Gross: ${payroll.grossSalary} | Status: ${payroll.status} | Days Present: ${payroll.daysPresent || 'N/A'}`,
      module: 'payroll',
      metadata: {
        payrollRecordId: payroll.id,
        employeeId: payroll.employee.id,
        userId: payroll.employee.user_id,
        employeeName: `${payroll.employee.user.first_name} ${payroll.employee.user.last_name}`,
        employeeEmail: payroll.employee.user.email,
        profilePic: payroll.employee.user.profile_pic || null,
        month: payroll.month,
        year: payroll.year,
        grossSalary: payroll.grossSalary,
        netSalary: payroll.netSalary,
        totalDeductions: payroll.totalDeductions,
        bonuses: payroll.bonuses,
        status: payroll.status,
        daysPresent: payroll.daysPresent,
        daysAbsent: payroll.daysAbsent,
        paidLeaves: payroll.paidLeaves,
        unpaidLeaves: payroll.unpaidLeaves,
        generatedBy: payroll.generatedBy ? `${payroll.generatedBy.first_name} ${payroll.generatedBy.last_name}` : null,
        approvedBy: payroll.approvedBy ? `${payroll.approvedBy.first_name} ${payroll.approvedBy.last_name}` : null,
      },
    }));

    return { items, total };
  }
}
