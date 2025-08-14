import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between } from 'typeorm';
import { Timesheet } from '../../entities/timesheet.entity';
import { Attendance } from '../../entities/attendance.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class TimesheetService {
  constructor(
    @InjectRepository(Timesheet)
    private readonly timesheetRepo: Repository<Timesheet>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async startWork(userId: string) {
    const now = new Date();
    const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const startOfNextDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

    // Basic validations
    const todaysAttendance = await this.attendanceRepo.find({
      where: {
        user_id: userId,
        timestamp: Between(startOfDayUtc, new Date(startOfNextDayUtc.getTime() - 1)),
      },
    });
    const hasCheckIn = todaysAttendance.some(r => r.type === 'check-in');
    const hasCheckOut = todaysAttendance.some(r => r.type === 'check-out');
    if (!hasCheckIn) {
      throw new BadRequestException('You must check in before starting work');
    }
    if (hasCheckOut) {
      throw new BadRequestException('You already checked out today');
    }

    const active = await this.timesheetRepo.findOne({ where: { user_id: userId, end_time: IsNull() } });
    if (active) throw new BadRequestException('Active work session already exists');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const fullName = user ? `${user.first_name} ${user.last_name}` : null;
    const record = this.timesheetRepo.create({ user_id: userId, start_time: now, end_time: null, employee_full_name: fullName });
    return this.timesheetRepo.save(record);
  }

  async endWork(userId: string) {
    const active = await this.timesheetRepo.findOne({ where: { user_id: userId, end_time: IsNull() } });
    if (!active) throw new NotFoundException('No active work session');
    active.end_time = new Date();
    active.duration_hours = Math.round(((active.end_time.getTime() - new Date(active.start_time).getTime()) / (1000 * 60 * 60)) * 100) / 100;
    if (!active.employee_full_name) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      active.employee_full_name = user ? `${user.first_name} ${user.last_name}` : null;
    }
    return this.timesheetRepo.save(active);
  }

  async autoEndIfActive(userId: string) {
    const active = await this.timesheetRepo.findOne({ where: { user_id: userId, end_time: IsNull() } });
    if (!active) return null;
    active.end_time = new Date();
    active.duration_hours = Math.round(((active.end_time.getTime() - new Date(active.start_time).getTime()) / (1000 * 60 * 60)) * 100) / 100;
    if (!active.employee_full_name) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      active.employee_full_name = user ? `${user.first_name} ${user.last_name}` : null;
    }
    return this.timesheetRepo.save(active);
  }

  async list(userId: string) {
    const sessions = await this.timesheetRepo.find({
      where: { user_id: userId },
      order: { start_time: 'DESC' }
    });
    const sessionsWithDuration = sessions.map((s) => {
      const durationHours = s.duration_hours ?? (s.end_time ? Math.round(((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60 * 60)) * 100) / 100 : null);
      return { ...s, durationHours, employee_full_name: s.employee_full_name ?? undefined };
    });
    const totalHours = Math.round((sessionsWithDuration.reduce((sum, s) => sum + (s.durationHours || 0), 0)) * 100) / 100;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const fullName = user ? `${user.first_name} ${user.last_name}` : undefined;
    return { employee: { userId, fullName }, totalHours, sessions: sessionsWithDuration };
  }

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
