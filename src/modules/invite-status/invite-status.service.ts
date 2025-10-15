import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Employee } from "../../entities/employee.entity";
import { User } from "../../entities/user.entity";

@Injectable()
export class InviteStatusService {
  private readonly logger = new Logger(InviteStatusService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Updates invite status based on user's first login time
   * @param userId - The user ID to check
   */
  async updateInviteStatusOnLogin(userId: string): Promise<void> {
    try {
      const employee = await this.employeeRepo.findOne({
        where: { user_id: userId },
        relations: ["user"],
      });

      if (!employee) {
        this.logger.warn(`No employee found for user ID: ${userId}`);
        return;
      }

      // Only update if current status is 'Invite Sent'
      if (employee.invite_status === "Invite Sent") {
        employee.invite_status = "Joined";
        await this.employeeRepo.save(employee);
        this.logger.log(
          `Updated invite status to 'Joined' for employee: ${employee.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update invite status for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Checks and updates expired invites based on 24-hour rule
   * @param tenantId - Optional tenant ID to limit the scope
   */
  async checkAndUpdateExpiredInvites(tenantId?: string): Promise<number> {
    try {
      const queryBuilder = this.employeeRepo
        .createQueryBuilder("employee")
        .leftJoinAndSelect("employee.user", "user")
        .where("employee.invite_status = :status", { status: "Invite Sent" })
        .andWhere("user.first_login_time IS NULL")
        .andWhere("employee.created_at < :expiryTime", {
          expiryTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        });

      if (tenantId) {
        queryBuilder.andWhere("user.tenant_id = :tenantId", { tenantId });
      }

      const expiredEmployees = await queryBuilder.getMany();

      if (expiredEmployees.length === 0) {
        return 0;
      }

      // Update all expired invites
      const updateResult = await this.employeeRepo
        .createQueryBuilder()
        .update(Employee)
        .set({ invite_status: "Invite Expired" })
        .where("id IN (:...ids)", {
          ids: expiredEmployees.map((emp) => emp.id),
        })
        .execute();

      this.logger.log(
        `Updated ${updateResult.affected} expired invites to 'Invite Expired'`,
      );
      return updateResult.affected || 0;
    } catch (error) {
      this.logger.error(
        `Failed to check and update expired invites: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Gets invite status for a specific employee
   * @param employeeId - The employee ID
   */
  async getInviteStatus(employeeId: string): Promise<string | null> {
    try {
      const employee = await this.employeeRepo.findOne({
        where: { id: employeeId },
        relations: ["user"],
      });

      if (!employee) {
        return null;
      }

      // Check if invite should be expired
      if (
        employee.invite_status === "Invite Sent" &&
        !employee.user.first_login_time &&
        employee.created_at < new Date(Date.now() - 24 * 60 * 60 * 1000)
      ) {
        // Update to expired
        employee.invite_status = "Invite Expired";
        await this.employeeRepo.save(employee);
        return "Invite Expired";
      }

      return employee.invite_status;
    } catch (error) {
      this.logger.error(
        `Failed to get invite status for employee ${employeeId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Manually sets invite status for an employee
   * @param employeeId - The employee ID
   * @param status - The new status
   */
  async setInviteStatus(
    employeeId: string,
    status: "Invite Sent" | "Invite Expired" | "Joined",
  ): Promise<boolean> {
    try {
      const updateResult = await this.employeeRepo.update(employeeId, {
        invite_status: status,
      });
      this.logger.log(
        `Manually set invite status to '${status}' for employee: ${employeeId}`,
      );
      return (updateResult.affected || 0) > 0;
    } catch (error) {
      this.logger.error(
        `Failed to set invite status for employee ${employeeId}: ${error.message}`,
      );
      return false;
    }
  }
}
