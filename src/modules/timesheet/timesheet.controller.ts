import { Controller, Post, Get, UseGuards, Req, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TimesheetService } from './timesheet.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Request } from 'express';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/guards/company.guard';

@ApiTags('Timesheet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timesheet')
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  @Post('start')
  async start(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.timesheetService.startWork(userId);
  }

  @Post('end')
  async end(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.timesheetService.endWork(userId);
  }

  @Get()
  async list(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.timesheetService.list(userId);
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async summary(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const tenantId = req.user.tenant_id;
    return this.timesheetService.summaryByTenant(tenantId, from, to);
  }
}
