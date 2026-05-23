import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { InviteStatus } from '../../common/constants/enums';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

@Injectable()
export class InviteStatusService {
  private readonly logger = new Logger(InviteStatusService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantDbService: TenantDatabaseService,
  ) {}

  async updateInviteStatusOnLogin(userId: string): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });

      if (!user) {
        this.logger.warn(`No user found for ID: ${userId}`);
        return;
      }

      await this.tenantDbService.withTenantSchema(
        user.tenant_id,
        async (em) => {
          const employee = await em.getRepository(Employee).findOne({
            where: { user_id: userId },
          });

          if (!employee) {
            this.logger.warn(
              `No employee found for user ID: ${userId} in tenant ${user.tenant_id}`,
            );
            return;
          }

          if (employee.invite_status === InviteStatus.INVITE_SENT) {
            employee.invite_status = InviteStatus.JOINED;
            await em.getRepository(Employee).save(employee);
            this.logger.log(
              `Updated invite status to 'Joined' for employee: ${employee.id}`,
            );
          }
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to update invite status for user ${userId}: ${errorMessage}`,
      );
    }
  }

  async checkAndUpdateExpiredInvites(tenantId?: string): Promise<number> {
    try {
      const tenants = tenantId
        ? await this.tenantRepo.find({
            where: { id: tenantId, status: 'active' },
          })
        : await this.tenantRepo.find({ where: { status: 'active' } });

      let totalExpired = 0;
      const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const tenant of tenants) {
        try {
          const expired = await this.tenantDbService.withTenantSchema(
            tenant.id,
            async (em) => {
              const expiredEmployees = await em
                .getRepository(Employee)
                .createQueryBuilder('employee')
                .leftJoinAndSelect('employee.user', 'user')
                .where('employee.invite_status = :status', {
                  status: InviteStatus.INVITE_SENT,
                })
                .andWhere('user.first_login_time IS NULL')
                .andWhere('employee.created_at < :expiryTime', { expiryTime })
                .getMany();

              if (expiredEmployees.length === 0) return 0;

              const updateResult = await em
                .getRepository(Employee)
                .createQueryBuilder()
                .update(Employee)
                .set({ invite_status: InviteStatus.INVITE_EXPIRED })
                .where('id IN (:...ids)', {
                  ids: expiredEmployees.map((e) => e.id),
                })
                .execute();

              return updateResult.affected || 0;
            },
          );

          totalExpired += expired;
        } catch (tenantError) {
          const msg =
            tenantError instanceof Error
              ? tenantError.message
              : String(tenantError);
          this.logger.error(
            `Failed to check expired invites for tenant ${tenant.id}: ${msg}`,
          );
        }
      }

      if (totalExpired > 0) {
        this.logger.log(
          `Updated ${totalExpired} expired invites to 'Invite Expired'`,
        );
      }
      return totalExpired;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to check and update expired invites: ${errorMessage}`,
      );
      return 0;
    }
  }

  async getInviteStatus(
    employeeId: string,
    tenantId: string,
  ): Promise<string | null> {
    try {
      return await this.tenantDbService.withTenantSchema(
        tenantId,
        async (em) => {
          const employee = await em.getRepository(Employee).findOne({
            where: { id: employeeId },
            relations: ['user'],
          });

          if (!employee) return null;

          if (
            employee.invite_status === InviteStatus.INVITE_SENT &&
            !employee.user.first_login_time &&
            employee.created_at < new Date(Date.now() - 24 * 60 * 60 * 1000)
          ) {
            employee.invite_status = InviteStatus.INVITE_EXPIRED;
            await em.getRepository(Employee).save(employee);
            return InviteStatus.INVITE_EXPIRED;
          }

          return employee.invite_status;
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to get invite status for employee ${employeeId}: ${errorMessage}`,
      );
      return null;
    }
  }

  async setInviteStatus(
    employeeId: string,
    tenantId: string,
    status: InviteStatus,
  ): Promise<boolean> {
    try {
      return await this.tenantDbService.withTenantSchema(
        tenantId,
        async (em) => {
          const updateResult = await em
            .getRepository(Employee)
            .update(employeeId, { invite_status: status });
          this.logger.log(
            `Manually set invite status to '${status}' for employee: ${employeeId}`,
          );
          return (updateResult.affected || 0) > 0;
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to set invite status for employee ${employeeId}: ${errorMessage}`,
      );
      return false;
    }
  }
}
