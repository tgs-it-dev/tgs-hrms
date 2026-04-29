import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, IsNull } from "typeorm";
import { Timesheet } from "../../entities/timesheet.entity";
import { Attendance } from "../../entities/attendance.entity";
import { User } from "../../entities/user.entity";
import { AttendanceType } from "../../common/constants/enums";
import { TenantDatabaseService } from "../../common/services/tenant-database.service";

@Injectable()
export class TimesheetService {
  constructor(
    @InjectRepository(Timesheet)
    private readonly timesheetRepo: Repository<Timesheet>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tenantDbService: TenantDatabaseService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async getTenantIdForUser(userId: string): Promise<string | null> {
    const result = await this.dataSource.query<{ tenant_id: string }[]>(
      `SELECT tenant_id FROM public.users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return result[0]?.tenant_id ?? null;
  }

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<
      { schema_provisioned: boolean }[]
    >(`SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`, [
      tenantId,
    ]);
    return result[0]?.schema_provisioned ?? false;
  }

  async startWork(userId: string) {
    const now = new Date();

    const startOfDayUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const startOfNextDayUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );

    const tenantId = await this.getTenantIdForUser(userId);
    const isProvisioned = tenantId
      ? await this.isTenantSchemaProvisioned(tenantId)
      : false;

    const fetchLatestCheckIn = (repo: Repository<Attendance>) =>
      repo
        .createQueryBuilder(`attendance`)
        .where(`attendance.user_id = :userId`, { userId })
        .andWhere(
          `attendance.timestamp >= :startOfDayUtc AND attendance.timestamp < :startOfNextDayUtc`,
          { startOfDayUtc, startOfNextDayUtc },
        )
        .orderBy(`attendance.timestamp`, `DESC`)
        .getOne();

    const latestAttendance =
      isProvisioned && tenantId
        ? await this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
            fetchLatestCheckIn(em.getRepository(Attendance)),
          )
        : await fetchLatestCheckIn(this.attendanceRepo);

    if (
      !latestAttendance ||
      latestAttendance.type !== AttendanceType.CHECK_IN
    ) {
      throw new BadRequestException("You must check in before starting work");
    }

    
    const activeSession = await this.timesheetRepo.findOne({
      where: { user_id: userId, end_time: IsNull() },
    });
    if (activeSession) {
      throw new BadRequestException('Active work session already exists');
    }

    
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

  
  async endWork(userId: string) {
    const activeSession = await this.timesheetRepo.findOne({
      where: { user_id: userId, end_time: IsNull() },
    });
    if (!activeSession) return null;

    activeSession.end_time = new Date();
    activeSession.duration_hours =
      Math.round(
        ((activeSession.end_time.getTime() - new Date(activeSession.start_time).getTime()) /
          (1000 * 60 * 60)) *
          100
      ) / 100;

    if (!activeSession.employee_full_name) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      activeSession.employee_full_name = user ? `${user.first_name} ${user.last_name}` : null;
    }

    return this.timesheetRepo.save(activeSession);
  }

  
  async autoEndIfActive(userId: string) {
    const activeSession = await this.timesheetRepo.findOne({
      where: { user_id: userId, end_time: IsNull() },
    });
    if (!activeSession) return null;

    activeSession.end_time = new Date();
    activeSession.duration_hours =
      Math.round(
        ((activeSession.end_time.getTime() - new Date(activeSession.start_time).getTime()) /
          (1000 * 60 * 60)) *
          100
      ) / 100;

    if (!activeSession.employee_full_name) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      activeSession.employee_full_name = user ? `${user.first_name} ${user.last_name}` : null;
    }

    return this.timesheetRepo.save(activeSession);
  }

  
  async list(userId: string, page: number = 1) {
    const limit = 10; 
    const skip = (page - 1) * limit;

    const [sessions, total] = await this.timesheetRepo.findAndCount({
      where: { user_id: userId },
      order: { start_time: 'DESC' },
      skip,
      take: limit,
    });

    const sessionsWithDuration = sessions.map((s) => {
      const durationHours =
        s.duration_hours ??
        (s.end_time
          ? Math.round(
              ((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) /
                (1000 * 60 * 60)) *
                100
            ) / 100
          : null);
      return { ...s, durationHours, employee_full_name: s.employee_full_name ?? undefined };
    });

    const totalHours =
      Math.round(sessionsWithDuration.reduce((sum, s) => sum + (s.durationHours || 0), 0) * 100) /
      100;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const fullName = user ? `${user.first_name} ${user.last_name}` : undefined;

    const totalPages = Math.ceil(total / limit);

    return {
      items: {
        employee: { userId, fullName },
        totalHours,
        sessions: sessionsWithDuration,
      },
      total,
      page,
      limit,
      totalPages,
    };
  }

  
  async summaryByTenant(tenantId: string, from?: string, to?: string, page: number = 1) {
    const limit = 25;
    const skip = (page - 1) * limit;

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

  
    const totalQuery = qb.clone();
    const total = await totalQuery.getCount();

  
    const items = await qb
      .select('u.id', 'user_id')
      .addSelect("CONCAT(u.first_name, ' ', u.last_name)", 'employee_name')
      .addSelect(
        'ROUND(SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time)) / 3600)::numeric, 2)',
        'total_hours'
      )
      .groupBy('u.id')
      .addGroupBy('u.first_name')
      .addGroupBy('u.last_name')
      .orderBy('employee_name', 'ASC')
      .offset(skip)
      .limit(limit)
      .getRawMany();

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
