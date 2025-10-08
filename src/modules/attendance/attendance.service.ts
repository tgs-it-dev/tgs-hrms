import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { AttendanceType } from '../../common/constants/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { TimesheetService } from '../timesheet/timesheet.service'; // Import TimesheetService
import { Employee } from '../../entities/employee.entity'; // Import Employee entity

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly timesheetService: TimesheetService // Inject TimesheetService
  ) {}

  async create(userId: string, dto: CreateAttendanceDto) {
    const now = new Date();
    
    // Validate attendance logic
    if (dto.type === AttendanceType.CHECK_IN) {
      // Check if user already has an active session (check-in without checkout)
      const activeSession = await this.getActiveSession(userId);
      if (activeSession) {
        throw new BadRequestException('You already have an active session. Please check out first.');
      }
    } else if (dto.type === AttendanceType.CHECK_OUT) {
      // Check if user has an active session to check out from
      const activeSession = await this.getActiveSession(userId);
      if (!activeSession) {
        throw new BadRequestException('No active session found. Please check in first.');
      }
    }
    
    const attendance = this.attendanceRepo.create({
      type: dto.type,
      user_id: userId,
      timestamp: now,
    });
    const saved = await this.attendanceRepo.save(attendance);
    
    // If the type is 'check-out', end the active work session by calling TimesheetService's autoEndIfActive
    if (dto.type === AttendanceType.CHECK_OUT) {
      await this.timesheetService.autoEndIfActive(userId);
    }

    return saved;
  }

  // Helper method to get active session (check-in without matching checkout)
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

    // Check if there's a checkout after this check-in
    const matchingCheckOut = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId })
      .andWhere('a.type = :type', { type: AttendanceType.CHECK_OUT })
      .andWhere('a.timestamp > :after', { after: latestCheckIn.timestamp })
      .orderBy('a.timestamp', 'ASC')
      .getOne();

    // If no matching checkout found, the session is active
    return matchingCheckOut ? null : latestCheckIn;
  }

  // Daily summary: one row per day with proper cross-day session handling
  async findAll(userId?: string, page: number = 1) {
    const limit = 20;
    const skip = (page - 1) * limit;
    const query = this.attendanceRepo.createQueryBuilder('attendance');
    if (userId) {
      query.where('attendance.user_id = :userId', { userId });
    }

    const [records, total] = await query
      .orderBy('attendance.timestamp', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Group records by user sessions (checkin-checkout pairs)
    const sessions: Array<{ checkIn: Attendance; checkOut?: Attendance; startDate: string }> = [];
    const checkIns: Attendance[] = [];
    const checkOuts: Attendance[] = [];

    // Separate check-ins and check-outs
    for (const record of records) {
      if (record.type === AttendanceType.CHECK_IN) {
        checkIns.push(record);
      } else if (record.type === AttendanceType.CHECK_OUT) {
        checkOuts.push(record);
      }
    }

    // Match check-ins with their corresponding check-outs
    for (const checkIn of checkIns) {
      const startDate = checkIn.timestamp.toISOString().split('T')[0];
      
      // Find the first checkout after this checkin
      const matchingCheckOut = checkOuts.find(
        checkout => checkout.timestamp > checkIn.timestamp
      );

      sessions.push({
        checkIn,
        checkOut: matchingCheckOut,
        startDate
      });

      // Remove the used checkout to avoid double-matching
      if (matchingCheckOut) {
        const index = checkOuts.indexOf(matchingCheckOut);
        checkOuts.splice(index, 1);
      }
    }

    // Group sessions by their start date
    const groupedByDate: Record<string, { checkIn?: Attendance; checkOut?: Attendance }> = {};
    for (const session of sessions) {
      if (!groupedByDate[session.startDate]) {
        groupedByDate[session.startDate] = {};
      }
      
      // Keep the latest check-in for this date
      if (!groupedByDate[session.startDate].checkIn || 
          session.checkIn.timestamp > (groupedByDate[session.startDate].checkIn?.timestamp || new Date(0))) {
        groupedByDate[session.startDate].checkIn = session.checkIn;
        groupedByDate[session.startDate].checkOut = session.checkOut;
      }
    }

    const items = Object.entries(groupedByDate).map(([date, { checkIn, checkOut }]) => {
      let workedHours = 0;
      // Only count hours if checkout is after checkin
      if (checkIn && checkOut && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)) {
        const diffMs =
          new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
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

    const totalPages = Math.ceil(total / limit);
    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // Raw events list for building multiple sessions per day in UI
  // async findEvents(userId?: string, page: number = 1) {
  //  const limit = 20;
  //  const skip = (page - 1) * limit;

  //  const qb = this.attendanceRepo.createQueryBuilder('attendance')
  //    .leftJoinAndSelect('attendance.user', 'user')
  //    .orderBy('attendance.timestamp', 'DESC');

  //    if (userId) {
  //      qb.where('attendance.user_id = :userId', { userId });
  //      }

  //  const [items, total] = await qb
  //    .skip(skip)
  //    .take(limit)
  //    .getManyAndCount();

  //  const totalPages = Math.ceil(total / limit);
  //  return {
  //    items,
  //    total,
  //    page,
  //    limit,
  //    totalPages,
  //  };
  // }

  // Return check-in and its matching checkout for today, or latest session if no today's session
  // This method handles cross-day sessions and provides fallback to latest session
  async getTodaySummary(userId: string) {
    const now = new Date();
    
    // Use local timezone boundaries to determine "today"
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    
    // First, try to get today's check-in
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
      // Found today's check-in, use it
      latestCheckIn = todayCheckIn;
    } else {
      // No today's check-in, fallback to latest check-in regardless of date
      latestCheckIn = await this.attendanceRepo
        .createQueryBuilder('a')
        .where('a.user_id = :userId', { userId })
        .andWhere('a.type = :type', { type: 'check-in' })
        .orderBy('a.timestamp', 'DESC')
        .getOne();
    }
    
    let matchingCheckOut: Attendance | null = null;
    if (latestCheckIn) {
      // Look for checkout after the latest check-in, regardless of date
      // This handles cross-day sessions (checkin on Day 1, checkout on Day 2)
      matchingCheckOut = await this.attendanceRepo
        .createQueryBuilder('a')
        .where('a.user_id = :userId', { userId })
      .andWhere('a.type = :type', { type: AttendanceType.CHECK_OUT })
        .andWhere('a.timestamp > :after', { after: latestCheckIn.timestamp })
        .orderBy('a.timestamp', 'ASC') // Get the first checkout after checkin
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

  // async getAllAttendance(tenantId: string, page: number = 1) {
  //  const limit = 20;
  //  const skip = (page - 1) * limit;

  //  const [items, total] = await this.attendanceRepo.findAndCount({
  //    where: { user: { tenant_id: tenantId } },
  //    relations: ['user'],
  //    order: { timestamp: 'DESC' },
  //    skip,
  //    take: limit,
  //  });

  //  const totalPages = Math.ceil(total / limit);
  //  return {
  //    items,
  //    total,
  //    page,
  //    limit,
  //    totalPages,
  //  };
  // }

  // Get total attendance for the current month (one per day per employee)
  async getTotalAttendanceForCurrentMonth(tenantId: string): Promise<{ totalAttendance: number }> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Query: count unique (user_id, date) pairs for the tenant in the month
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

  async getAllAttendance(tenantId: string, page = 1, startDate?: string, endDate?: string) {
    const limit = 20;
    const skip = (page - 1) * limit;
    const qb = this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.user', 'user')
      .where('user.tenant_id = :tenantId', { tenantId });
    if (startDate) qb.andWhere('attendance.timestamp >= :start', { start: new Date(startDate) });
    if (endDate)
      qb.andWhere('attendance.timestamp <= :end', { end: new Date(endDate + 'T23:59:59.999Z') });
    qb.orderBy('attendance.timestamp', 'DESC').skip(skip).take(limit);
    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit);
    return { items, total, page, limit, totalPages };
  }
  async findEvents(userId?: string, page = 1, startDate?: string, endDate?: string) {
    const limit = 20;
    const skip = (page - 1) * limit;
    const qb = this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.user', 'user')
      .orderBy('attendance.timestamp', 'DESC');
    if (userId) qb.where('attendance.user_id = :userId', { userId });
    if (startDate) qb.andWhere('attendance.timestamp >= :start', { start: new Date(startDate) });
    if (endDate)
      qb.andWhere('attendance.timestamp <= :end', { end: new Date(endDate + 'T23:59:59.999Z') });
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    const totalPages = Math.ceil(total / limit);
    return { items, total, page, limit, totalPages };
  }

  // Get team attendance for managers (similar to TeamLeaves)
  async getTeamAttendance(
    managerId: string,
    tenantId: string,
    page: number = 1
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
        checkOut: Date | null;
        workedHours: number;
      }[];
      totalDaysWorked: number;
      totalHoursWorked: number;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get team member user IDs
    const teamMembers = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .leftJoin('employee.team', 'team')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('team.manager_id = :managerId', { managerId })
      .andWhere('employee.user_id != :managerId', { managerId })
      .skip(skip)
      .take(limit)
      .getMany();

    this.logger.debug(`Fetched ${teamMembers.length} team members for manager ${managerId}`);
    const userIds = teamMembers.map((member) => member.user_id);

    this.logger.debug(`Team member userIds: ${JSON.stringify(userIds)}`);
    if (userIds.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Get attendance records for team members
    const attendanceRecords = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .where('attendance.user_id IN (:...userIds)', { userIds })
      .orderBy('attendance.timestamp', 'ASC')
      .getMany();

    this.logger.debug(`Fetched ${attendanceRecords.length} attendance records for team`);

    // Group attendance by user and create proper sessions (handles cross-day)
    const groupedAttendance: Record<
      string,
      Record<string, { checkIn?: Attendance; checkOut?: Attendance }>
    > = {};
    
    // Process each user's attendance separately
    for (const userId of userIds) {
      const userRecords = attendanceRecords.filter(r => r.user_id === userId);
      const checkIns = userRecords.filter(r => r.type === 'check-in');
      const checkOuts = userRecords.filter(r => r.type === 'check-out');
      
      // Match check-ins with their corresponding check-outs
      const sessions: Array<{ checkIn: Attendance; checkOut?: Attendance; startDate: string }> = [];
      
      for (const checkIn of checkIns) {
        const startDate = checkIn.timestamp.toISOString().split('T')[0];
        
        // Find the first checkout after this checkin
        const matchingCheckOut = checkOuts.find(
          checkout => checkout.timestamp > checkIn.timestamp
        );
        
        sessions.push({
          checkIn,
          checkOut: matchingCheckOut,
          startDate
        });
        
        // Remove the used checkout to avoid double-matching
        if (matchingCheckOut) {
          const index = checkOuts.indexOf(matchingCheckOut);
          checkOuts.splice(index, 1);
        }
      }
      
      // Group sessions by start date
      if (!groupedAttendance[userId]) {
        groupedAttendance[userId] = {};
      }
      
      for (const session of sessions) {
        if (!groupedAttendance[userId][session.startDate]) {
          groupedAttendance[userId][session.startDate] = {};
        }
        
        // Keep the latest check-in for this date
        if (!groupedAttendance[userId][session.startDate].checkIn || 
            session.checkIn.timestamp > (groupedAttendance[userId][session.startDate].checkIn?.timestamp || new Date(0))) {
          groupedAttendance[userId][session.startDate].checkIn = session.checkIn;
          groupedAttendance[userId][session.startDate].checkOut = session.checkOut;
        }
      }
    }

    // Transform the data
    const transformedMembers = teamMembers.map((member) => {
      const userAttendance = groupedAttendance[member.user_id] || {};
      const attendanceData = Object.entries(userAttendance).map(([date, { checkIn, checkOut }]) => {
        let workedHours = 0;
        if (checkIn && checkOut && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)) {
          const diffMs =
            new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
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
      return {
        user_id: member.user_id,
        first_name: member.user.first_name,
        last_name: member.user.last_name,
        email: member.user.email,
        profile_pic: member.user.profile_pic || undefined,
        designation: member.designation?.title || 'N/A',
        department: member.designation?.department?.name || 'N/A',
        attendance: attendanceData,
        totalDaysWorked,
        totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      };
    });

    const totalPages = Math.ceil(teamMembers.length / limit);
    return {
      items: transformedMembers,
      total: teamMembers.length,
      page,
      limit,
      totalPages,
    };
  }
}
