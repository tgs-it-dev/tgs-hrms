import {
  Controller,
  Get,
  Query,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { LeaveService } from "./leave.service";
import { AuthenticatedRequest } from "src/common/types/request.types";

@ApiTags("Leave Balances")
@ApiBearerAuth()
@Controller("leave-balances")
export class LeaveBalancesController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get("me")
  @ApiOperation({
    summary: "Get my leave balances",
    description:
      "Returns allocated and used leave days per leave type for the authenticated employee.",
  })
  @ApiQuery({
    name: "year",
    required: false,
    type: Number,
    description: "Year (defaults to current year)",
  })
  async getMyBalances(
    @Request() req: AuthenticatedRequest,
    @Query("year", new DefaultValuePipe(0), ParseIntPipe) year: number,
  ) {
    const { id, tenant_id } = req.user;
    const targetYear = year > 0 ? year : undefined;
    const balances = await this.leaveService.getMyBalances(
      id,
      tenant_id,
      targetYear,
    );
    return {
      year: targetYear ?? new Date().getFullYear(),
      balances: balances.map((b) => ({
        leaveTypeId: b.leaveTypeId,
        leaveType: b.leaveType?.name ?? null,
        allocated: b.allocated,
        used: b.used,
        remaining: b.allocated - b.used,
      })),
    };
  }
}
