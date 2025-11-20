import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { AttendanceType } from '../../common/constants/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { TimesheetService } from '../timesheet/timesheet.service'; 
import { Employee } from '../../entities/employee.entity'; 

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly timesheetService: TimesheetService 
  ) {}

  async create(userId: string, dto: CreateAttendanceDto) {
    const now = new Date();
    

    if (dto.type === AttendanceType.CHECK_IN) {
    
      const activeSession = await this.getActiveSession(userId);
      if (activeSession) {
        throw new BadRequestException('You already have an active session. Please check out first.');
      }
    } else if (dto.type === AttendanceType.CHECK_OUT) {

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
    
  
    if (dto.type === AttendanceType.CHECK_OUT) {
      await this.timesheetService.autoEndIfActive(userId);
    }

    return saved;
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
      const startDate = checkIn.timestamp.toISOString().split('T')[0];
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
      if (!groupedByDate[session.startDate]) {
        groupedByDate[session.startDate] = {};
      }
      if (!groupedByDate[session.startDate].checkIn || 
          session.checkIn.timestamp > (groupedByDate[session.startDate].checkIn?.timestamp || new Date(0))) {
        groupedByDate[session.startDate].checkIn = session.checkIn;
        groupedByDate[session.startDate].checkOut = session.checkOut;
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
        checkOut: Date | null;
        workedHours: number;
      }[];
      totalDaysWorked: number;
      totalHoursWorked: number;
    }>;
    total: number;
  }> {
    // fetch all employee records for the team
    const teamMembers = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .leftJoin('employee.team', 'team')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('team.manager_id = :managerId', { managerId })
      .andWhere('employee.user_id != :managerId', { managerId })
      .getMany();
    const userIds = teamMembers.map((member) => member.user_id);
    if (userIds.length === 0) {
      return {
        items: [],
        total: 0,
      };
    }
    // Apply date filter if provided
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
        const startDate = checkIn.timestamp.toISOString().split('T')[0];
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
        if (!groupedAttendance[userIdKey][session.startDate]) {
          groupedAttendance[userIdKey][session.startDate] = {};
        }
        if (!groupedAttendance[userIdKey][session.startDate].checkIn || 
            session.checkIn.timestamp > (groupedAttendance[userIdKey][session.startDate].checkIn?.timestamp || new Date(0))) {
          groupedAttendance[userIdKey][session.startDate].checkIn = session.checkIn;
          groupedAttendance[userIdKey][session.startDate].checkOut = session.checkOut;
        }
      }
    }
    const transformedMembers = teamMembers.map((member) => {
      // Ensure consistent UUID string comparison
      const userIdKey = String(member.user_id);
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
    
    // Filter out employees with no attendance records
    const filteredMembers = transformedMembers.filter(
      (member) => member.attendance.length > 0 && (member.totalDaysWorked > 0 || member.totalHoursWorked > 0)
    );
    
    return {
      items: filteredMembers,
      total: filteredMembers.length,
    };
  }
}
