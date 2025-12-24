import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { GlobalSearchDto, SearchModule, SearchResultItem, GlobalSearchResponseDto } from './dto/search.dto';

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
  ) {}

  /**
   * Global search across all modules with tenant and role filtering
   */
  async globalSearch(
    query: string | undefined,
    tenantId: string,
    userRole: string,
    module: SearchModule = SearchModule.ALL,
    limit: number = 10,
  ): Promise<GlobalSearchResponseDto> {
    this.logger.log(`Global search: query="${query}", tenantId="${tenantId}", role="${userRole}", module="${module}"`);

    // System-admin and network-admin can search across all tenants if tenantId is GLOBAL_SYSTEM_TENANT_ID
    // Otherwise, filter by the provided tenantId (even for admin roles)
    const isSystemAdmin = userRole === 'system-admin';
    const isNetworkAdmin = userRole === 'network-admin';
    const isAdminRole = isSystemAdmin || isNetworkAdmin;
    const searchAllTenants = isAdminRole && tenantId === GLOBAL_SYSTEM_TENANT_ID;
    const searchTerm = query ? `%${query}%` : '%';

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

    // Search Employees
    if (module === SearchModule.ALL || module === SearchModule.EMPLOYEES) {
      const employeeResults = await this.searchEmployees(
        searchTerm,
        tenantId,
        searchAllTenants,
        limit,
      );
      results.employees = employeeResults.items;
      counts.employees = employeeResults.total;
    }

    // Search Leaves
    if (module === SearchModule.ALL || module === SearchModule.LEAVES) {
      const leaveResults = await this.searchLeaves(
        searchTerm,
        tenantId,
        searchAllTenants,
        limit,
      );
      results.leaves = leaveResults.items;
      counts.leaves = leaveResults.total;
    }

    // Search Assets
    if (module === SearchModule.ALL || module === SearchModule.ASSETS) {
      const assetResults = await this.searchAssets(
        searchTerm,
        tenantId,
        searchAllTenants,
        limit,
      );
      results.assets = assetResults.items;
      counts.assets = assetResults.total;
    }

    // Search Asset Requests
    if (module === SearchModule.ALL || module === SearchModule.ASSET_REQUESTS) {
      const assetRequestResults = await this.searchAssetRequests(
        searchTerm,
        tenantId,
        searchAllTenants,
        limit,
      );
      results.assetRequests = assetRequestResults.items;
      counts.assetRequests = assetRequestResults.total;
    }

    // Search Teams
    if (module === SearchModule.ALL || module === SearchModule.TEAMS) {
      const teamResults = await this.searchTeams(
        searchTerm,
        tenantId,
        searchAllTenants,
        limit,
      );
      results.teams = teamResults.items;
      counts.teams = teamResults.total;
    }

    // Search Attendance
    if (module === SearchModule.ALL || module === SearchModule.ATTENDANCE) {
      const attendanceResults = await this.searchAttendance(
        searchTerm,
        tenantId,
        searchAllTenants,
        limit,
      );
      results.attendance = attendanceResults.items;
      counts.attendance = attendanceResults.total;
    }

    // Search Benefits
    if (module === SearchModule.ALL || module === SearchModule.BENEFITS) {
      const benefitResults = await this.searchBenefits(
        searchTerm,
        tenantId,
        searchAllTenants,
        limit,
      );
      results.benefits = benefitResults.items;
      counts.benefits = benefitResults.total;
    }

    // Search Payroll
    if (module === SearchModule.ALL || module === SearchModule.PAYROLL) {
      const payrollResults = await this.searchPayroll(
        searchTerm,
        tenantId,
        searchAllTenants,
        limit,
      );
      results.payroll = payrollResults.items;
      counts.payroll = payrollResults.total;
    }

    const totalResults = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return {
      query: query || '',
      totalResults,
      results,
      counts,
    };
  }

  /**
   * Search employees by name, email, phone, CNIC
   */
  private async searchEmployees(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
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

    const [employees, total] = await queryBuilder
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = employees.map((emp) => ({
      id: emp.id,
      title: `${emp.user.first_name} ${emp.user.last_name}`,
      description: `${emp.user.email} | ${emp.designation?.title || 'N/A'} | ${emp.team?.name || 'No Team'}`,
      module: 'employees',
      metadata: {
        email: emp.user.email,
        phone: emp.user.phone,
        designation: emp.designation?.title,
        team: emp.team?.name,
        status: emp.status,
        cnic: emp.cnic_number,
      },
    }));

    return { items, total };
  }

  /**
   * Search leaves by employee name, leave type, reason, status
   */
  private async searchLeaves(
    searchTerm: string,
    tenantId: string,
    searchAllTenants: boolean,
    limit: number,
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

    const [leaves, total] = await queryBuilder
      .orderBy('leave.createdAt', 'DESC')
      .take(limit)
      .getManyAndCount();

    const items: SearchResultItem[] = leaves.map((leave) => ({
      id: leave.id,
      title: `${leave.employee.first_name} ${leave.employee.last_name} - ${leave.leaveType.name}`,
      description: `${leave.reason.substring(0, 100)}${leave.reason.length > 100 ? '...' : ''} | Status: ${leave.status} | ${leave.totalDays} days`,
      module: 'leaves',
      metadata: {
        employeeName: `${leave.employee.first_name} ${leave.employee.last_name}`,
        leaveType: leave.leaveType.name,
        startDate: leave.startDate,
        endDate: leave.endDate,
        totalDays: leave.totalDays,
        status: leave.status,
        reason: leave.reason,
        approver: leave.approver ? `${leave.approver.first_name} ${leave.approver.last_name}` : null,
      },
    }));

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
          employeeName: `${eb.employee.user.first_name} ${eb.employee.user.last_name}`,
          employeeEmail: eb.employee.user.email,
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
        employeeName: `${payroll.employee.user.first_name} ${payroll.employee.user.last_name}`,
        employeeEmail: payroll.employee.user.email,
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
