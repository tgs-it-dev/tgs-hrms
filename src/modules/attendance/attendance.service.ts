import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  AttendanceType,
  CheckInApprovalStatus,
} from '../../common/constants/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { Geofence, GeofenceStatus } from '../../entities/geofence.entity';
import { Employee } from '../../entities/employee.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { TimesheetService } from '../timesheet/timesheet.service';
import { TeamService } from '../team/team.service';
import { isPointWithinGeofence, checkPointWithinGeofence } from '../../common/utils/geofence.util';
import { NotificationGateway } from '../notification/notification.gateway';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../common/constants/enums';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Geofence)
    private readonly geofenceRepo: Repository<Geofence>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly timesheetService: TimesheetService,
    private readonly teamService: TeamService,
    private readonly notificationGateway: NotificationGateway,
    private readonly notificationService: NotificationService,
  ) {}

  async create(userId: string, dto: CreateAttendanceDto, tenantId?: string) {
    const now = new Date();

    let nearBoundary = false;

    if (dto.type === AttendanceType.CHECK_IN) {
      // Validate location is provided for check-in (location disabled or not shared = clear message for toast)
      const hasValidLocation =
        dto.latitude != null &&
        dto.longitude != null &&
        !Number.isNaN(Number(dto.latitude)) &&
        !Number.isNaN(Number(dto.longitude));
      if (!hasValidLocation) {
        throw new BadRequestException('Turn on Your Location');
      }
      const lat = Number(dto.latitude);
      const lng = Number(dto.longitude);

      // Validate location is within geofence boundary
      if (tenantId) {
        const validationResult = await this.validateCheckInLocationWithThreshold(
          userId,
          tenantId,
          lat,
          lng,
        );
        nearBoundary = validationResult.nearBoundary;
      }

      const activeSession = await this.getActiveSession(userId);
      if (activeSession) {
        throw new BadRequestException(
          'You already have an active session. Please check out first.',
        );
      }
    } else if (dto.type === AttendanceType.CHECK_OUT) {
      // Validate location is provided for check-out (location disabled or not shared = clear message for toast)
      const hasValidLocation =
        dto.latitude != null &&
        dto.longitude != null &&
        !Number.isNaN(Number(dto.latitude)) &&
        !Number.isNaN(Number(dto.longitude));
      if (!hasValidLocation) {
        throw new BadRequestException('Turn on Your Location');
      }
      const lat = Number(dto.latitude);
      const lng = Number(dto.longitude);

      // Validate location is within geofence boundary
      if (tenantId) {
        const validationResult = await this.validateCheckInLocationWithThreshold(
          userId,
          tenantId,
          lat,
          lng,
        );
        nearBoundary = validationResult.nearBoundary;
      }

      const activeSession = await this.getActiveSession(userId);
      if (!activeSession) {
        throw new BadRequestException(
          'No active session found. Please check in first.',
        );
      }
    }

    // Get employee info for manager notification
    const employee = await this.employeeRepo.findOne({
      where: { user_id: userId },
      relations: ['user', 'team'],
    });

    // Managers: auto-approve their own check-in (no one approves them). Team members: PENDING (need manager approval).
    let approvalStatus: CheckInApprovalStatus | null = null;
    let approvedBy: string | null = null;
    let approvedAt: Date | null = null;
    if (dto.type === AttendanceType.CHECK_IN) {
      const isManager =
        tenantId &&
        (await this.teamService.getManagerTeams(userId, tenantId)).length > 0;
      if (isManager) {
        approvalStatus = CheckInApprovalStatus.APPROVED;
        approvedBy = userId;
        approvedAt = now;
      } else {
        approvalStatus = CheckInApprovalStatus.PENDING;
      }
    }

    const attendance = this.attendanceRepo.create({
      type: dto.type,
      user_id: userId,
      timestamp: now,
      approval_status: approvalStatus,
      approved_by: approvedBy,
      approved_at: approvedAt,
      near_boundary: nearBoundary,
    });
    const saved = await this.attendanceRepo.save(attendance);

    // Notify manager: save in DB (record) + real-time WebSocket. Skip when manager is notifying themselves (own attendance).
    const managerId = employee?.team?.manager_id;
    if (employee && managerId && tenantId && managerId !== userId) {
      const employeeName = `${employee.user.first_name} ${employee.user.last_name}`.trim();
      const actionType = dto.type === AttendanceType.CHECK_IN ? 'checked in' : 'checked out';
      const nearBoundaryText = saved.near_boundary ? ' (Near Boundary)' : '';
      const message = `${employeeName} ${actionType}${nearBoundaryText}`;

      try {
        const notification = await this.notificationService.create(
          managerId,
          tenantId,
          message,
          NotificationType.ATTENDANCE,
          { relatedEntityType: 'attendance', relatedEntityId: saved.id },
        );
        this.notificationGateway.sendToUser(managerId, 'new_notification', {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          related_entity_type: 'attendance',
          related_entity_id: saved.id,
          created_at: notification.created_at,
        });
        this.notificationGateway.sendToUser(managerId, 'attendance_event', {
          type: dto.type,
          employee_id: userId,
          employee_name: employeeName,
          timestamp: saved.timestamp,
          message,
          near_boundary: saved.near_boundary,
          notification_id: notification.id,
          related_entity_type: 'attendance',
          related_entity_id: saved.id,
        });
      } catch (error) {
        console.error('Failed to create attendance notification:', error);
      }
    }

    if (dto.type === AttendanceType.CHECK_OUT) {
      await this.timesheetService.autoEndIfActive(userId);
    }

    return saved;
  }

  /**
   * Validate check-in/check-out location against active geofences for employee's team
   * Returns both validation result and whether the location is near boundary
   */
  private async validateCheckInLocationWithThreshold(
    userId: string,
    tenantId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ nearBoundary: boolean }> {
    // Get employee's team_id
    const employee = await this.employeeRepo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    // If employee has no team, allow check-in (no geofence restriction)
    if (!employee.team_id) {
      return { nearBoundary: false };
    }

    // Get active geofences for the employee's team
    const activeGeofences = await this.geofenceRepo.find({
      where: {
        team_id: employee.team_id,
        tenant_id: tenantId,
        status: GeofenceStatus.ACTIVE,
      },
    });

    if (activeGeofences.length === 0) {
      throw new BadRequestException(
        'No active geofence found for your team. Please contact your manager to set up a geofence.',
      );
    }

    // Check if location is within any active geofence (with threshold support)
    let isWithinGeofence = false;
    let isNearBoundary = false;

    for (const geofence of activeGeofences) {
      const result = checkPointWithinGeofence(latitude, longitude, geofence);

      if (result.isWithin) {
        isWithinGeofence = true;
        isNearBoundary = result.isNearBoundary;
        break;
      }
    }

    if (!isWithinGeofence) {
      throw new BadRequestException('You are not in the Geo Fencing Zone');
    }

    return { nearBoundary: isNearBoundary };
  }

  /**
   * Validate check-in/check-out location against active geofences for employee's team
   * @deprecated Use validateCheckInLocationWithThreshold instead
   */
  private async validateCheckInLocation(
    userId: string,
    tenantId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    await this.validateCheckInLocationWithThreshold(userId, tenantId, latitude, longitude);
  }

  
  private async getActiveSession(userId: string): Promise<Attendance | null> {
    const latestCheckIn = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId })
      .andWhere('a.type = :type', { type: AttendanceType.CHECK_IN })
      .orderBy('a.timestamp', 'DESC')
      .getOne();

    if (!latestCheckIn) {
      return null;
    }

    
    const matchingCheckOut = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId })
      .andWhere('a.type = :type', { type: AttendanceType.CHECK_OUT })
      .andWhere('a.timestamp > :after', { after: latestCheckIn.timestamp })
      .orderBy('a.timestamp', 'ASC')
      .getOne();

    
    return matchingCheckOut ? null : latestCheckIn;
  }

  
  async findAll(userId?: string) {
    const query = this.attendanceRepo.createQueryBuilder('attendance');
    if (userId) {
      query.where('attendance.user_id = :userId', { userId });
    }
    const records = await query.orderBy('attendance.timestamp', 'ASC').getMany();

    // Maintain the summarizing and grouping logic
    const sessions: Array<{ checkIn: Attendance; checkOut?: Attendance; startDate: string }> = [];
    const checkIns: Attendance[] = [];
    const checkOuts: Attendance[] = [];
    for (const record of records) {
      if (record.type === AttendanceType.CHECK_IN) {
        checkIns.push(record);
      } else if (record.type === AttendanceType.CHECK_OUT) {
        checkOuts.push(record);
      }
    }
    for (const checkIn of checkIns) {
      const startDate = checkIn.timestamp.toISOString().split('T')[0] || '';
      const matchingCheckOut = checkOuts.find(
        checkout => checkout.timestamp > checkIn.timestamp
      );
      sessions.push({
        checkIn,
        checkOut: matchingCheckOut,
        startDate
      });
      if (matchingCheckOut) {
        const index = checkOuts.indexOf(matchingCheckOut);
        checkOuts.splice(index, 1);
      }
    }
    const groupedByDate: Record<string, { checkIn?: Attendance; checkOut?: Attendance }> = {};
    for (const session of sessions) {
      const dateKey = session.startDate;
      if (!dateKey) continue;
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = {};
      }
      if (!groupedByDate[dateKey].checkIn || 
          session.checkIn.timestamp > (groupedByDate[dateKey].checkIn?.timestamp || new Date(0))) {
        groupedByDate[dateKey].checkIn = session.checkIn;
        groupedByDate[dateKey].checkOut = session.checkOut;
      }
    }
    const items = Object.entries(groupedByDate).map(([date, { checkIn, checkOut }]) => {
      let workedHours = 0;
      if (checkIn && checkOut && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)) {
        const diffMs = new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
        workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }
      return {
        date,
        checkIn: checkIn?.timestamp || null,
        checkOut:
          checkOut && checkIn && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)
            ? checkOut.timestamp
            : null,
        workedHours,
      };
    });
    return { items, total: items.length };
  }

 
  async getTodaySummary(userId: string) {
    const now = new Date();
    
    
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    
    
    const todayCheckIn = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId })
      .andWhere('a.type = :type', { type: AttendanceType.CHECK_IN })
      .andWhere('a.timestamp >= :startOfDay AND a.timestamp < :startOfNextDay', {
        startOfDay,
        startOfNextDay,
      })
      .orderBy('a.timestamp', 'DESC')
      .getOne();
    
    let latestCheckIn: Attendance | null = null;
    
    if (todayCheckIn) {
      
      latestCheckIn = todayCheckIn;
    } else {
      
      latestCheckIn = await this.attendanceRepo
        .createQueryBuilder('a')
        .where('a.user_id = :userId', { userId })
        .andWhere('a.type = :type', { type: AttendanceType.CHECK_IN })
        .orderBy('a.timestamp', 'DESC')
        .getOne();
    }
    
    let matchingCheckOut: Attendance | null = null;
    if (latestCheckIn) {
    
      matchingCheckOut = await this.attendanceRepo
        .createQueryBuilder('a')
        .where('a.user_id = :userId', { userId })
      .andWhere('a.type = :type', { type: AttendanceType.CHECK_OUT })
        .andWhere('a.timestamp > :after', { after: latestCheckIn.timestamp })
        .orderBy('a.timestamp', 'ASC') 
        .getOne();
    }
    
    return {
      checkIn: latestCheckIn?.timestamp || null,
      checkOut: matchingCheckOut?.timestamp || null,
    };
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    const attendance = await this.attendanceRepo.findOne({ where: { id } });
    if (!attendance) throw new NotFoundException('Attendance not found');
    Object.assign(attendance, dto);
    return this.attendanceRepo.save(attendance);
  }

  async remove(id: string) {
    const attendance = await this.attendanceRepo.findOne({ where: { id } });
    if (!attendance) throw new NotFoundException('Attendance not found');
    return this.attendanceRepo.remove(attendance);
  }

  async getTotalAttendanceForCurrentMonth(tenantId: string): Promise<{ totalAttendance: number }> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  
    const result = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoin('attendance.user', 'user')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('attendance.timestamp >= :startOfMonth AND attendance.timestamp <= :endOfMonth', {
        startOfMonth,
        endOfMonth,
      })
      .select(['attendance.user_id AS user_id', 'DATE(attendance.timestamp) AS date'])
      .groupBy('attendance.user_id')
      .addGroupBy('DATE(attendance.timestamp)')
      .getRawMany();

    return { totalAttendance: result.length };
  }

  async getAllAttendance(tenantId: string, startDate?: string, endDate?: string) {
    const qb = this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.user', 'user')
      .where('user.tenant_id = :tenantId', { tenantId });
    if (startDate) qb.andWhere('attendance.timestamp >= :start', { start: new Date(startDate) });
    if (endDate) qb.andWhere('attendance.timestamp <= :end', { end: new Date(endDate + 'T23:59:59.999Z') });
    qb.orderBy('attendance.timestamp', 'DESC');
    const items = await qb.getMany();
    return { items, total: items.length };
  }

  async getAllAttendanceBatch(
    tenantId: string,
    startDate?: string,
    endDate?: string,
    skip: number = 0,
    take: number = 1000
  ) {
    const qb = this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.user', 'user')
      .where('user.tenant_id = :tenantId', { tenantId });
    if (startDate) qb.andWhere('attendance.timestamp >= :start', { start: new Date(startDate) });
    if (endDate) qb.andWhere('attendance.timestamp <= :end', { end: new Date(endDate + 'T23:59:59.999Z') });
    qb.orderBy('attendance.timestamp', 'DESC')
      .skip(skip)
      .take(take);
    return await qb.getMany();
  }
  async findEvents(userId?: string, startDate?: string, endDate?: string) {
    const qb = this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.user', 'user')
      .orderBy('attendance.timestamp', 'DESC');
    if (userId) qb.where('attendance.user_id = :userId', { userId });
    if (startDate) qb.andWhere('attendance.timestamp >= :start', { start: new Date(startDate) });
    if (endDate) qb.andWhere('attendance.timestamp <= :end', { end: new Date(endDate + 'T23:59:59.999Z') });
    const items = await qb.getMany();
    return { items, total: items.length };
  }

  
  async getTeamAttendance(
    managerId: string,
    tenantId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    items: Array<{
      user_id: string;
      first_name: string;
      last_name: string;
      email: string;
      profile_pic?: string;
      designation: string;
      department: string;
      attendance: {
        date: string;
        checkIn: Date | null;
        checkInId: string | null;
        checkOut: Date | null;
        checkOutId: string | null;
        workedHours: number;
        approvalStatus: CheckInApprovalStatus | null;
        approvalRemarks: string | null;
        approvedBy: string | null;
        approvedAt: Date | null;
      }[];
      totalDaysWorked: number;
      totalHoursWorked: number;
    }>;
    total: number;
  }> {
    // Use TeamService.getAllMembersForManager() to get all team members
    // This ensures all members are returned regardless of attendance
    // We need to fetch all pages to get complete list
    let allTeamMembers: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const result = await this.teamService.getAllMembersForManager(tenantId, managerId, page);
      allTeamMembers = allTeamMembers.concat(result.items);
      hasMore = result.items.length === result.limit && page < result.totalPages;
      page++;
    }
    
    if (allTeamMembers.length === 0) {
      return {
        items: [],
        total: 0,
      };
    }
    
    // Extract user IDs from team members
    const userIds = allTeamMembers.map((member) => member.user.id);
    
    // Apply date filter ONLY to attendance records, not to members
    const attendanceQuery = this.attendanceRepo
      .createQueryBuilder('attendance')
      .where('attendance.user_id IN (:...userIds)', { userIds });
    
    if (startDate) {
      attendanceQuery.andWhere('attendance.timestamp >= :start', { start: new Date(startDate) });
    }
    if (endDate) {
      attendanceQuery.andWhere('attendance.timestamp <= :end', { end: new Date(endDate + 'T23:59:59.999Z') });
    }
    
    const attendanceRecords = await attendanceQuery
      .orderBy('attendance.timestamp', 'ASC')
      .getMany();
    
    const groupedAttendance: Record<
      string,
      Record<string, { checkIn?: Attendance; checkOut?: Attendance }>
    > = {};
    
    // Initialize groupedAttendance for all userIds to ensure all team members are included
    // Use string keys for consistent UUID comparison
    for (const userId of userIds) {
      groupedAttendance[String(userId)] = {};
    }
    
    for (const userId of userIds) {
      const userIdKey = String(userId);
      // Ensure proper UUID comparison by converting to string
      const userRecords = attendanceRecords.filter(r => String(r.user_id) === userIdKey);
      const checkIns = userRecords.filter(r => r.type === AttendanceType.CHECK_IN);
      const checkOuts = userRecords.filter(r => r.type === AttendanceType.CHECK_OUT);
      const sessions: Array<{ checkIn: Attendance; checkOut?: Attendance; startDate: string }> = [];
      for (const checkIn of checkIns) {
        const startDate = checkIn.timestamp.toISOString().split('T')[0] || '';
        const matchingCheckOut = checkOuts.find(
          checkout => checkout.timestamp > checkIn.timestamp
        );
        sessions.push({
          checkIn,
          checkOut: matchingCheckOut,
          startDate
        });
        if (matchingCheckOut) {
          const index = checkOuts.indexOf(matchingCheckOut);
          checkOuts.splice(index, 1);
        }
      }
      for (const session of sessions) {
        const dateKey = session.startDate;
        if (!dateKey) continue;
        const userGroup = groupedAttendance[userIdKey];
        if (!userGroup) continue;
        if (!userGroup[dateKey]) {
          userGroup[dateKey] = {};
        }
        if (!userGroup[dateKey].checkIn || 
            session.checkIn.timestamp > (userGroup[dateKey].checkIn?.timestamp || new Date(0))) {
          userGroup[dateKey].checkIn = session.checkIn;
          userGroup[dateKey].checkOut = session.checkOut;
        }
      }
    }
    
    // Transform team members from TeamService response to match Swagger response structure
    const transformedMembers = allTeamMembers.map((member) => {
      // Ensure consistent UUID string comparison
      const userIdKey = String(member.user.id);
      const userAttendance = groupedAttendance[userIdKey] || {};
      const attendanceData = Object.entries(userAttendance).map(([date, { checkIn, checkOut }]) => {
        let workedHours = 0;
        if (checkIn && checkOut && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)) {
          const diffMs = new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
          workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        }
        return {
          date,
          checkIn: checkIn?.timestamp || null,
          checkInId: checkIn?.id || null,
          checkOut:
            checkOut && checkIn && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)
              ? checkOut.timestamp
              : null,
          checkOutId:
            checkOut && checkIn && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)
              ? checkOut.id
              : null,
          workedHours,
          approvalStatus: checkIn?.approval_status || null,
          approvalRemarks: checkIn?.approval_remarks || null,
          approvedBy: checkIn?.approved_by || null,
          approvedAt: checkIn?.approved_at || null,
        };
      });
      const totalDaysWorked = attendanceData.filter((day) => day.checkIn && day.checkOut).length;
      const totalHoursWorked = attendanceData.reduce((sum, day) => sum + day.workedHours, 0);
      return {
        user_id: member.user.id,
        first_name: member.user.first_name,
        last_name: member.user.last_name,
        email: member.user.email,
        profile_pic: member.user.profile_pic || undefined,
        designation: member.designation?.title || 'N/A',
        department: member.department?.name || 'N/A',
        attendance: attendanceData,
        totalDaysWorked,
        totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      };
    });
    
    // Return all team members, even if they have no attendance records in the date range
    return {
      items: transformedMembers,
      total: transformedMembers.length,
    };
  }

  /**
   * Get attendance grouped by tenant for system-admin
   * @param tenantId - Optional tenant ID to filter by specific tenant
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @returns Attendance grouped by tenant with user details
   */
  async getAttendanceByTenant(
    tenantId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    tenants: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_status: string;
      employees: Array<{
        user_id: string;
        first_name: string;
        last_name: string;
        email: string;
        profile_pic?: string;
        attendance: {
          date: string;
          checkIn: Date | null;
          checkOut: Date | null;
          workedHours: number;
        }[];
        totalDaysWorked: number;
        totalHoursWorked: number;
      }>;
      totalEmployees: number;
      totalAttendanceRecords: number;
    }>;
    totalTenants: number;
  }> {
    // Build query to get attendance with user and tenant relations
    const qb = this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.user', 'user')
      .leftJoinAndSelect('user.tenant', 'tenant')
      .orderBy('attendance.timestamp', 'ASC');

    // Filter by tenant if provided
    if (tenantId) {
      qb.where('user.tenant_id = :tenantId', { tenantId });
    }

    // Apply date filters
    if (startDate) {
      if (tenantId) {
        qb.andWhere('attendance.timestamp >= :start', { start: new Date(startDate) });
      } else {
        qb.where('attendance.timestamp >= :start', { start: new Date(startDate) });
      }
    }
    if (endDate) {
      qb.andWhere('attendance.timestamp <= :end', { end: new Date(endDate + 'T23:59:59.999Z') });
    }

    const attendanceRecords = await qb.getMany();

    // Group attendance by tenant
    const tenantMap: Record<
      string,
      {
        tenant_id: string;
        tenant_name: string;
        tenant_status: string;
        userAttendance: Record<
          string,
          Record<string, { checkIn?: Attendance; checkOut?: Attendance }>
        >;
      }
    > = {};

    // Process attendance records
    for (const record of attendanceRecords) {
      if (!record.user || !record.user.tenant) {
        continue; // Skip records without user or tenant
      }

      const tenantIdKey = record.user.tenant.id;
      const userId = record.user_id;

      // Initialize tenant if not exists
      if (!tenantMap[tenantIdKey]) {
        tenantMap[tenantIdKey] = {
          tenant_id: tenantIdKey,
          tenant_name: record.user.tenant.name,
          tenant_status: record.user.tenant.status,
          userAttendance: {},
        };
      }

      // Initialize user if not exists
      if (!tenantMap[tenantIdKey].userAttendance[userId]) {
        tenantMap[tenantIdKey].userAttendance[userId] = {};
      }
    }

    // Group records by tenant and user first
    const recordsByTenantAndUser: Record<string, Record<string, Attendance[]>> = {};
    for (const record of attendanceRecords) {
      if (!record.user || !record.user.tenant) continue;
      
      const tenantIdKey = record.user.tenant.id;
      const userId = record.user_id;
      
      if (!recordsByTenantAndUser[tenantIdKey]) {
        recordsByTenantAndUser[tenantIdKey] = {};
      }
      if (!recordsByTenantAndUser[tenantIdKey][userId]) {
        recordsByTenantAndUser[tenantIdKey][userId] = [];
      }
      recordsByTenantAndUser[tenantIdKey][userId].push(record);
    }

    // Process each tenant-user combination to match check-ins with check-outs
    for (const [tenantIdKey, usersMap] of Object.entries(recordsByTenantAndUser)) {
      const tenantData = tenantMap[tenantIdKey];
      if (!tenantData) continue;
      
      for (const [userId, userRecords] of Object.entries(usersMap)) {
        const userAttendance = tenantData.userAttendance[userId];
        if (!userAttendance) continue;
        
        // Separate check-ins and check-outs
        const checkIns = userRecords.filter(r => r.type === AttendanceType.CHECK_IN);
        const checkOuts = userRecords.filter(r => r.type === AttendanceType.CHECK_OUT);
        
        // Match check-ins with check-outs (similar to getTeamAttendance logic)
        const sessions: Array<{ checkIn: Attendance; checkOut?: Attendance; startDate: string }> = [];
        const remainingCheckOuts = [...checkOuts];
        
        for (const checkIn of checkIns) {
          const startDate = checkIn.timestamp.toISOString().split('T')[0] || '';
          const matchingCheckOut = remainingCheckOuts.find(
            checkout => checkout.timestamp > checkIn.timestamp
          );
          sessions.push({
            checkIn,
            checkOut: matchingCheckOut,
            startDate
          });
          if (matchingCheckOut) {
            const index = remainingCheckOuts.indexOf(matchingCheckOut);
            remainingCheckOuts.splice(index, 1);
          }
        }
        
        // Group sessions by date (using check-in date)
        for (const session of sessions) {
          const dateKey = session.startDate;
          if (!dateKey) continue;
          if (!userAttendance[dateKey]) {
            userAttendance[dateKey] = {};
          }
          // Keep the latest check-in and its matching check-out for each date
          if (!userAttendance[dateKey].checkIn || 
              session.checkIn.timestamp > (userAttendance[dateKey].checkIn?.timestamp || new Date(0))) {
            userAttendance[dateKey].checkIn = session.checkIn;
            userAttendance[dateKey].checkOut = session.checkOut;
          }
        }
      }
    }

    // Build final response structure
    const tenants: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_status: string;
      employees: Array<{
        user_id: string;
        first_name: string;
        last_name: string;
        email: string;
        profile_pic?: string;
        attendance: {
          date: string;
          checkIn: Date | null;
          checkOut: Date | null;
          workedHours: number;
        }[];
        totalDaysWorked: number;
        totalHoursWorked: number;
      }>;
      totalEmployees: number;
      totalAttendanceRecords: number;
    }> = [];

    // Create a map of user details
    const userDetailsMap: Record<string, any> = {};
    for (const record of attendanceRecords) {
      if (!record.user) continue;
      const userId = record.user_id;
      if (!userDetailsMap[userId]) {
        userDetailsMap[userId] = {
          user_id: record.user.id,
          first_name: record.user.first_name,
          last_name: record.user.last_name,
          email: record.user.email,
          profile_pic: record.user.profile_pic,
        };
      }
    }

    // Build tenant-wise employee attendance
    for (const [, tenantData] of Object.entries(tenantMap)) {
      const employees: Array<{
        user_id: string;
        first_name: string;
        last_name: string;
        email: string;
        profile_pic?: string;
        attendance: {
          date: string;
          checkIn: Date | null;
          checkOut: Date | null;
          workedHours: number;
        }[];
        totalDaysWorked: number;
        totalHoursWorked: number;
      }> = [];

      for (const [userId, dateAttendance] of Object.entries(tenantData.userAttendance)) {
        const userDetails = userDetailsMap[userId];
        if (!userDetails) continue;

        const attendanceData = Object.entries(dateAttendance).map(([date, { checkIn, checkOut }]) => {
          let workedHours = 0;
          if (checkIn && checkOut && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)) {
            const diffMs = new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
            workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
          }
          return {
            date,
            checkIn: checkIn?.timestamp || null,
            checkOut:
              checkOut && checkIn && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)
                ? checkOut.timestamp
                : null,
            workedHours,
          };
        });

        const totalDaysWorked = attendanceData.filter((day) => day.checkIn && day.checkOut).length;
        const totalHoursWorked = attendanceData.reduce((sum, day) => sum + day.workedHours, 0);

        employees.push({
          user_id: userDetails.user_id,
          first_name: userDetails.first_name,
          last_name: userDetails.last_name,
          email: userDetails.email,
          profile_pic: userDetails.profile_pic,
          attendance: attendanceData,
          totalDaysWorked,
          totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
        });
      }

      // Sort employees by name
      employees.sort((a, b) => {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      const totalAttendanceRecords = employees.reduce(
        (sum, emp) => sum + emp.attendance.length,
        0
      );

      tenants.push({
        tenant_id: tenantData.tenant_id,
        tenant_name: tenantData.tenant_name,
        tenant_status: tenantData.tenant_status,
        employees,
        totalEmployees: employees.length,
        totalAttendanceRecords,
      });
    }

    // Sort tenants by name
    tenants.sort((a, b) => a.tenant_name.localeCompare(b.tenant_name));

    return {
      tenants,
      totalTenants: tenants.length,
    };
  }

  /**
   * Get today's check-ins for team members (Manager only)
   * Returns check-ins that are pending approval for today's date
   */
  async getTodayTeamCheckIns(
    managerId: string,
    tenantId: string
  ): Promise<{
    items: Array<{
      id: string;
      user_id: string;
      first_name: string;
      last_name: string;
      email: string;
      profile_pic?: string;
      designation: string;
      department: string;
      check_in_time: Date;
      approval_status: CheckInApprovalStatus | null;
      approved_by: string | null;
      approved_at: Date | null;
      approval_remarks: string | null;
    }>;
    total: number;
  }> {
    // Get all team members
    let allTeamMembers: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const result = await this.teamService.getAllMembersForManager(tenantId, managerId, page);
      allTeamMembers = allTeamMembers.concat(result.items);
      hasMore = result.items.length === result.limit && page < result.totalPages;
      page++;
    }
    
    if (allTeamMembers.length === 0) {
      return {
        items: [],
        total: 0,
      };
    }

    const userIds = allTeamMembers.map((member) => member.user.id);

    // Get today's date range
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
    );

    // Get today's check-ins for team members
    const todayCheckIns = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.user', 'user')
      .leftJoinAndSelect('attendance.approver', 'approver')
      .where('attendance.user_id IN (:...userIds)', { userIds })
      .andWhere('attendance.type = :type', { type: AttendanceType.CHECK_IN })
      .andWhere('attendance.timestamp >= :startOfDay', { startOfDay })
      .andWhere('attendance.timestamp < :endOfDay', { endOfDay })
      .orderBy('attendance.timestamp', 'DESC')
      .getMany();

    // Group by user and get the latest check-in per user
    const userCheckInMap = new Map<string, Attendance>();
    for (const checkIn of todayCheckIns) {
      const userId = checkIn.user_id;
      if (!userCheckInMap.has(userId) || 
          checkIn.timestamp > userCheckInMap.get(userId)!.timestamp) {
        userCheckInMap.set(userId, checkIn);
      }
    }

    // Transform to response format
    const items = Array.from(userCheckInMap.values()).map((checkIn) => {
      const member = allTeamMembers.find((m) => m.user.id === checkIn.user_id);
      return {
        id: checkIn.id,
        user_id: checkIn.user_id,
        first_name: checkIn.user.first_name,
        last_name: checkIn.user.last_name,
        email: checkIn.user.email,
        profile_pic: checkIn.user.profile_pic || undefined,
        designation: member?.designation?.title || 'N/A',
        department: member?.department?.name || 'N/A',
        check_in_time: checkIn.timestamp,
        approval_status: checkIn.approval_status,
        approved_by: checkIn.approved_by,
        approved_at: checkIn.approved_at,
        approval_remarks: checkIn.approval_remarks,
      };
    });

    // Sort by check-in time (latest first)
    items.sort((a, b) => 
      new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime()
    );

    return {
      items,
      total: items.length,
    };
  }

  /**
   * Approve a single check-in (Manager only)
   */
  async approveCheckIn(
    checkInId: string,
    managerId: string,
    tenantId: string,
    remarks?: string
  ): Promise<Attendance> {
    const checkIn = await this.attendanceRepo.findOne({
      where: { id: checkInId },
      relations: ['user'],
    });

    if (!checkIn) {
      throw new NotFoundException('Check-in record not found');
    }

    if (checkIn.type !== AttendanceType.CHECK_IN) {
      throw new BadRequestException('Only check-in records can be approved');
    }

    // Verify the employee is in the manager's team
    const isTeamMember = await this.verifyTeamMember(
      checkIn.user_id,
      managerId,
      tenantId
    );

    if (!isTeamMember) {
      throw new ForbiddenException('You can only approve check-ins for your team members');
    }

    checkIn.approval_status = CheckInApprovalStatus.APPROVED;
    checkIn.approved_by = managerId;
    checkIn.approved_at = new Date();
    checkIn.approval_remarks = remarks || null;

    const saved = await this.attendanceRepo.save(checkIn);

    // Notify employee: check-in approved (DB + real-time)
    try {
      const notification = await this.notificationService.create(
        checkIn.user_id,
        tenantId,
        'Your check-in has been approved',
        NotificationType.ATTENDANCE,
        { relatedEntityType: 'attendance', relatedEntityId: saved.id },
      );
      this.notificationGateway.sendToUser(checkIn.user_id, 'new_notification', {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        related_entity_type: 'attendance',
        related_entity_id: saved.id,
        created_at: notification.created_at,
      });
    } catch (error) {
      console.error('Failed to create check-in approval notification:', error);
    }

    return saved;
  }

  /**
   * Disapprove a single check-in (Manager only)
   */
  async disapproveCheckIn(
    checkInId: string,
    managerId: string,
    tenantId: string,
    remarks?: string
  ): Promise<Attendance> {
    const checkIn = await this.attendanceRepo.findOne({
      where: { id: checkInId },
      relations: ['user'],
    });

    if (!checkIn) {
      throw new NotFoundException('Check-in record not found');
    }

    if (checkIn.type !== AttendanceType.CHECK_IN) {
      throw new BadRequestException('Only check-in records can be disapproved');
    }

    // Verify the employee is in the manager's team
    const isTeamMember = await this.verifyTeamMember(
      checkIn.user_id,
      managerId,
      tenantId
    );

    if (!isTeamMember) {
      throw new ForbiddenException('You can only disapprove check-ins for your team members');
    }

    checkIn.approval_status = CheckInApprovalStatus.REJECTED;
    checkIn.approved_by = managerId;
    checkIn.approved_at = new Date();
    checkIn.approval_remarks = remarks || null;

    const saved = await this.attendanceRepo.save(checkIn);

    // Notify employee: check-in rejected (DB + real-time)
    try {
      const notification = await this.notificationService.create(
        checkIn.user_id,
        tenantId,
        'Your check-in was rejected',
        NotificationType.ATTENDANCE,
        { relatedEntityType: 'attendance', relatedEntityId: saved.id },
      );
      this.notificationGateway.sendToUser(checkIn.user_id, 'new_notification', {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        related_entity_type: 'attendance',
        related_entity_id: saved.id,
        created_at: notification.created_at,
      });
    } catch (error) {
      console.error('Failed to create check-in rejection notification:', error);
    }

    return saved;
  }

  /**
   * Approve all today's check-ins for team members at once (Manager only)
   */
  async approveAllCheckIns(
    managerId: string,
    tenantId: string,
    remarks?: string
  ): Promise<{ approved: number; items: Attendance[] }> {
    // Get today's check-ins for team members
    const { items } = await this.getTodayTeamCheckIns(managerId, tenantId);

    // Filter out already approved/rejected check-ins
    const pendingCheckIns = items.filter(
      (item) => !item.approval_status || item.approval_status === CheckInApprovalStatus.PENDING
    );

    if (pendingCheckIns.length === 0) {
      return { approved: 0, items: [] };
    }

    const checkInIds = pendingCheckIns.map((item) => item.id);
    const now = new Date();

    // Update all pending check-ins
    await this.attendanceRepo
      .createQueryBuilder()
      .update(Attendance)
      .set({
        approval_status: CheckInApprovalStatus.APPROVED,
        approved_by: managerId,
        approved_at: now,
        approval_remarks: remarks || null,
      })
      .where('id IN (:...ids)', { ids: checkInIds })
      .andWhere('type = :type', { type: AttendanceType.CHECK_IN })
      .execute();

    // Fetch updated records
    const updatedCheckIns = await this.attendanceRepo.find({
      where: { id: In(checkInIds) },
    });

    // Notify each employee: check-in approved (DB + real-time)
    for (const checkIn of updatedCheckIns) {
      try {
        const notification = await this.notificationService.create(
          checkIn.user_id,
          tenantId,
          'Your check-in has been approved',
          NotificationType.ATTENDANCE,
          { relatedEntityType: 'attendance', relatedEntityId: checkIn.id },
        );
        this.notificationGateway.sendToUser(checkIn.user_id, 'new_notification', {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          related_entity_type: 'attendance',
          related_entity_id: checkIn.id,
          created_at: notification.created_at,
        });
      } catch (error) {
        console.error(`Failed to notify employee ${checkIn.user_id} for check-in approval:`, error);
      }
    }

    return {
      approved: updatedCheckIns.length,
      items: updatedCheckIns,
    };
  }

  /**
   * Disapprove all today's check-ins for team members at once (Manager only)
   */
  async disapproveAllCheckIns(
    managerId: string,
    tenantId: string,
    remarks?: string
  ): Promise<{ disapproved: number; items: Attendance[] }> {
    // Get today's check-ins for team members
    const { items } = await this.getTodayTeamCheckIns(managerId, tenantId);

    // Filter out already approved/rejected check-ins
    const pendingCheckIns = items.filter(
      (item) => !item.approval_status || item.approval_status === CheckInApprovalStatus.PENDING
    );

    if (pendingCheckIns.length === 0) {
      return { disapproved: 0, items: [] };
    }

    const checkInIds = pendingCheckIns.map((item) => item.id);
    const now = new Date();

    // Update all pending check-ins
    await this.attendanceRepo
      .createQueryBuilder()
      .update(Attendance)
      .set({
        approval_status: CheckInApprovalStatus.REJECTED,
        approved_by: managerId,
        approved_at: now,
        approval_remarks: remarks || null,
      })
      .where('id IN (:...ids)', { ids: checkInIds })
      .andWhere('type = :type', { type: AttendanceType.CHECK_IN })
      .execute();

    // Fetch updated records
    const updatedCheckIns = await this.attendanceRepo.find({
      where: { id: In(checkInIds) },
    });

    // Notify each employee: check-in rejected (DB + real-time)
    for (const checkIn of updatedCheckIns) {
      try {
        const notification = await this.notificationService.create(
          checkIn.user_id,
          tenantId,
          'Your check-in was rejected',
          NotificationType.ATTENDANCE,
          { relatedEntityType: 'attendance', relatedEntityId: checkIn.id },
        );
        this.notificationGateway.sendToUser(checkIn.user_id, 'new_notification', {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          related_entity_type: 'attendance',
          related_entity_id: checkIn.id,
          created_at: notification.created_at,
        });
      } catch (error) {
        console.error(`Failed to notify employee ${checkIn.user_id} for check-in rejection:`, error);
      }
    }

    return {
      disapproved: updatedCheckIns.length,
      items: updatedCheckIns,
    };
  }

  /**
   * Helper method to verify if an employee is in the manager's team
   */
  private async verifyTeamMember(
    employeeUserId: string,
    managerId: string,
    tenantId: string
  ): Promise<boolean> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.teamService.getAllMembersForManager(tenantId, managerId, page);
      const isMember = result.items.some((member) => member.user.id === employeeUserId);
      
      if (isMember) {
        return true;
      }

      hasMore = result.items.length === result.limit && page < result.totalPages;
      page++;
    }

    return false;
  }
}
