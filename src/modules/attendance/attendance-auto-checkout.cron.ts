import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { Attendance } from '../../entities/attendance.entity';
import { Employee } from '../../entities/employee.entity';
import { Shift } from '../../entities/shift.entity';
import { AttendanceType, CheckInApprovalStatus } from '../../common/constants/enums';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

@Injectable()
export class AttendanceAutoCheckoutCron {
  private readonly logger = new Logger(AttendanceAutoCheckoutCron.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    private readonly tenantDbService: TenantDatabaseService,
  ) {}

  /**
   * Runs every 30 minutes.
   * Closes any open check-in sessions whose shift end time has passed.
   */
  @Cron('0 */30 * * * *')
  async handleAutoCheckout(): Promise<void> {
    this.logger.log('Auto-checkout cron started');
    const now = new Date();

    try {
      const tenants = await this.tenantRepo.find({
        where: { status: 'active' },
        select: ['id', 'schema_provisioned'],
      });

      let total = 0;
      for (const tenant of tenants) {
        try {
          const count = await this.processAutoCheckoutsForTenant(tenant.id, tenant.schema_provisioned, now);
          total += count;
        } catch (err) {
          this.logger.error(`Auto-checkout failed for tenant ${tenant.id}: ${(err as Error).message}`);
        }
      }

      if (total > 0) {
        this.logger.log(`Auto-checkout cron: closed ${total} open session(s)`);
      }
    } catch (err) {
      this.logger.error(`Auto-checkout cron error: ${(err as Error).message}`);
    }
  }

  private async processAutoCheckoutsForTenant(
    tenantId: string,
    isProvisioned: boolean,
    now: Date,
  ): Promise<number> {
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        this.closeOpenSessions(
          em.getRepository(Attendance),
          em.getRepository(Employee),
          tenantId,
          now,
        ),
      );
    }
    return this.closeOpenSessions(
      this.attendanceRepo,
      this.employeeRepo,
      tenantId,
      now,
    );
  }

  /**
   * Finds all active check-in sessions for the tenant and closes those
   * whose computed auto-checkout time is in the past.
   *
   * A session is "active" when the latest CHECK_IN for a user today has
   * no subsequent CHECK_OUT.
   */
  private async closeOpenSessions(
    attendanceRepo: Repository<Attendance>,
    employeeRepo: Repository<Employee>,
    tenantId: string,
    now: Date,
  ): Promise<number> {
    // Find all users in this tenant who have a CHECK_IN today with no CHECK_OUT after it
    const openCheckIns = await attendanceRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'user')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('a.type = :type', { type: AttendanceType.CHECK_IN })
      .andWhere('a.is_auto_checkout = false')
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM attendance co
          WHERE co.user_id = a.user_id
            AND co.type = :coType
            AND co.timestamp > a.timestamp
        )`,
        { coType: AttendanceType.CHECK_OUT },
      )
      .getMany();

    if (openCheckIns.length === 0) return 0;

    // Load shifts for all employees in one query
    const userIds = [...new Set(openCheckIns.map((c) => c.user_id))];
    const employees = await employeeRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.shift', 'shift')
      .where('e.user_id IN (:...userIds)', { userIds })
      .andWhere('e.deleted_at IS NULL')
      .getMany();

    const shiftByUserId = new Map<string, Shift | null>(
      employees.map((e) => [e.user_id, e.shift ?? null]),
    );

    let closed = 0;

    for (const checkIn of openCheckIns) {
      const shift = shiftByUserId.get(checkIn.user_id) ?? null;
      const autoCheckoutTime = this.computeAutoCheckoutTime(checkIn.timestamp, shift);

      if (now < autoCheckoutTime) continue;

      const record = attendanceRepo.create({
        user_id: checkIn.user_id,
        type: AttendanceType.CHECK_OUT,
        timestamp: autoCheckoutTime,
        approval_status: CheckInApprovalStatus.APPROVED,
        is_auto_checkout: true,
        approval_remarks: shift
          ? `Auto check-out: shift "${shift.name}" ended at ${shift.end_time}`
          : 'Auto check-out: session exceeded maximum duration',
      });

      await attendanceRepo.save(record);
      closed++;
    }

    return closed;
  }

  /**
   * Computes the wall-clock time at which an auto check-out should be recorded.
   *
   * Rules:
   * - If a shift is assigned, the checkout time is the shift's end_time on the
   *   appropriate day. Cross-midnight shifts (end <= start) add one day.
   * - If no shift is assigned, midnight of the check-in day is used as a safety cap.
   */
  computeAutoCheckoutTime(checkInTime: Date, shift: Shift | null): Date {
    if (!shift) {
      // No shift — cap at midnight (00:00:00) of the next calendar day
      const midnight = new Date(checkInTime);
      midnight.setHours(23, 59, 59, 999);
      return midnight;
    }

    const [startH, startM] = shift.start_time.split(':').map(Number);
    const [endH, endM] = shift.end_time.split(':').map(Number);

    const checkout = new Date(checkInTime);
    checkout.setHours(endH, endM, 0, 0);

    const crossesMidnight = endH * 60 + endM <= startH * 60 + startM;
    if (crossesMidnight) {
      checkout.setDate(checkout.getDate() + 1);
    }

    // Edge-case: computed checkout is still before or equal to check-in
    // (shouldn't happen with valid shift data, but guard anyway)
    if (checkout <= checkInTime) {
      checkout.setDate(checkout.getDate() + 1);
    }

    return checkout;
  }
}
