import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { EmployeeBenefit } from "src/entities/employee-benefit.entity";

@Injectable()
export class EmployeeBenefitsCronService {
  private readonly logger = new Logger(EmployeeBenefitsCronService.name);

  constructor(
    @InjectRepository(EmployeeBenefit)
    private readonly employeeBenefitRepo: Repository<EmployeeBenefit>,
  ) {}

  /**
   * Runs every day at midnight to expire benefits whose endDate has passed.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireOldBenefits(): Promise<void> {
    this.logger.log("Running daily employee benefit expiry check...");

    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to start of day

    const result = await this.employeeBenefitRepo
      .createQueryBuilder()
      .update(EmployeeBenefit)
      .set({ status: "expired" })
      .where("status = :status", { status: "active" })
      .andWhere("end_date IS NOT NULL AND end_date <= :today", { today })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} employee benefits.`);
    } else {
      this.logger.debug("No benefits to expire today.");
    }
  }
}
