import { Controller, Get, Query } from "@nestjs/common";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("attendance-summary")
  async attendanceSummary(
    @Query("userId") userId?: string,
    @Query("month") month?: string,
  ) {
    return this.reportsService.getAttendanceSummary(userId, month);
  }

  @Get("leave-summary")
  async leaveSummary(@Query("userId") userId?: string) {
    return this.reportsService.getLeaveSummary(userId);
  }

  @Get("headcount")
  async headcount() {
    return this.reportsService.getHeadcount();
  }
}
