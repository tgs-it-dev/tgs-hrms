import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between } from 'typeorm';
import { Timesheet } from '../../entities/timesheet.entity';
import { Attendance } from '../../entities/attendance.entity';
import { User } from '../../entities/user.entity';
import { PaginationService } from '../../common/services/pagination.service';

@Injectable()
export class TimesheetService {
  constructor(
    @InjectRepository(Timesheet)
    private readonly timesheetRepo: Repository<Timesheet>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private paginationService: PaginationService,
  ) {}

  // Start the work timer only if the user has checked in
async startWork(userId: string) {
  const now = new Date();
  // Define start and end of the day (UTC)
  const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const startOfNextDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

  // Find the most recent attendance record for the user today
  const latestAttendance = await this.attendanceRepo.createQueryBuilder('attendance')
    .where('attendance.user_id = :userId', { userId })
    .andWhere('attendance.timestamp >= :startOfDayUtc AND attendance.timestamp < :startOfNextDayUtc', {
      startOfDayUtc,
      startOfNextDayUtc,
    })
    .orderBy('attendance.timestamp', 'DESC')
    .getOne();

  // No attendance record means the user hasn't checked in
  if (!latestAttendance || latestAttendance.type !== 'check-in') {
    throw new BadRequestException('You must check in before starting work');
  }

  // Prevent starting a new session if one is already in progress
  const activeSession = await this.timesheetRepo.findOne({ where: { user_id: userId, end_time: IsNull() } });
  if (activeSession) {
    throw new BadRequestException('Active work session already exists');
  }

  // Create a new timesheet entry tied to this check-in
  const user = await this.userRepo.findOne({ where: { id: userId } });
  const fullName = user ? `${user.first_name} ${user.last_name}` : null;
  const record = this.timesheetRepo.create({
    user_id: userId,
    start_time: now,
    end_time: null,
    employee_full_name: fullName,
  });

  return this.timesheetRepo.save(record);
}


  // End the work session automatically when the user checks out
  async endWork(userId: string) {
    const activeSession = await this.timesheetRepo.findOne({ where: { user_id: userId, end_time: IsNull() } });
    if (!activeSession) throw new NotFoundException('No active work session found');

    activeSession.end_time = new Date();
    activeSession.duration_hours = Math.round(((activeSession.end_time.getTime() - new Date(activeSession.start_time).getTime()) / (1000 * 60 * 60)) * 100) / 100;

    if (!activeSession.employee_full_name) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      activeSession.employee_full_name = user ? `${user.first_name} ${user.last_name}` : null;
    }

    return this.timesheetRepo.save(activeSession);
  }

  // Automatically stop the active timer if there is one
  async autoEndIfActive(userId: string) {
    const activeSession = await this.timesheetRepo.findOne({ where: { user_id: userId, end_time: IsNull() } });
    if (!activeSession) return null;

    activeSession.end_time = new Date();
    activeSession.duration_hours = Math.round(((activeSession.end_time.getTime() - new Date(activeSession.start_time).getTime()) / (1000 * 60 * 60)) * 100) / 100;

    if (!activeSession.employee_full_name) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      activeSession.employee_full_name = user ? `${user.first_name} ${user.last_name}` : null;
    }

    return this.timesheetRepo.save(activeSession);
  }

  // List all the timesheets for a user
  async list(userId: string, page: number = 1, size: number = 25) {
    const result = await this.paginationService.paginate(
      this.timesheetRepo,
      page,
      size,
      { user_id: userId },
      { start_time: 'DESC' }
    );

    // Add duration calculation to each session
    const sessionsWithDuration = result.data.map((s) => {
      const durationHours = s.duration_hours ?? (s.end_time ? Math.round(((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60 * 60)) * 100) / 100 : null);
      return { ...s, durationHours, employee_full_name: s.employee_full_name ?? undefined };
    });

    return {
      ...result,
      data: sessionsWithDuration
    };
  }

  // Tenant-wise summary (admin-only)
  async summaryByTenant(tenantId: string, from?: string, to?: string) {
    const qb = this.timesheetRepo
      .createQueryBuilder('t')
      .innerJoin('t.user', 'u')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('t.end_time IS NOT NULL');

    if (from) {
      const fromDate = new Date(from);
      qb.andWhere('t.start_time >= :fromDate', { fromDate });
    }

    if (to) {
      const toDate = new Date(to);
      qb.andWhere('t.start_time <= :toDate', { toDate });
    }

    qb
      .select('u.id', 'user_id')
      .addSelect("CONCAT(u.first_name, ' ', u.last_name)", 'employee_name')
      .addSelect(
        "ROUND(SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time)) / 3600)::numeric, 2)",
        'total_hours',
      )
      .groupBy('u.id')
      .addGroupBy('u.first_name')
      .addGroupBy('u.last_name')
      .orderBy('employee_name', 'ASC');

    return qb.getRawMany();
  }
}
