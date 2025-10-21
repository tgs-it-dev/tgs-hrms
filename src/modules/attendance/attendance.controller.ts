import { Controller, Post, Get, Body, Query, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Request } from 'express';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Response } from 'express';
import { sendCsvResponse } from 'src/common/utils/csv.util';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a check-in/check-out event' })
  async createAttendance(@Body() createAttendanceDto: CreateAttendanceDto, @Req() req: Request) {
    const userId = (req.user as any).id;
    return this.attendanceService.create(userId, createAttendanceDto);
  }


  @Get()
  @ApiOperation({ summary: 'Get daily summaries (latest check-in/out) for a user' })
  findAll(@Query('userId') userId?: string) {
    return this.attendanceService.findAll(userId);
  }

  @Get('all')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('hr-admin', 'admin', 'system-admin', 'network-admin')
  @Permissions('manage_attendance')
  async findAllForAdmin(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.attendanceService.getAllAttendance(
      req.user.tenant_id,
      startDate,
      endDate
    );
  }
  @Get('events')
  async events(
    @Req() req: Request,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const id = userId || (req.user as any).id;
    return this.attendanceService.findEvents(id, startDate, endDate);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get today latest check-in and its matching check-out' })
  async today(@Req() req: Request, @Query('userId') userId?: string) {
    const id = userId || (req.user as any).id;
    return this.attendanceService.getTodaySummary(id);
  }

  @Get('team')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_attendance')
  @ApiOperation({ summary: 'Get team attendance records (Manager only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns team members attendance records with daily summaries',
    schema: {
      example: {
        items: [
          {
            user_id: 'user_id_1',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@company.com',
            profile_pic: 'profile_pic_url',
            designation: 'Software Developer',
            department: 'Engineering',
            attendance: [
              {
                date: '2024-01-15',
                checkIn: '2024-01-15T09:00:00Z',
                checkOut: '2024-01-15T17:30:00Z',
                workedHours: 8.5,
              },
            ],
            totalDaysWorked: 20,
            totalHoursWorked: 160.5,
          },
        ],
        total: 5,
      },
    },
  })
  async getTeamAttendance(@Req() req: any) {
    return this.attendanceService.getTeamAttendance(req.user.id, req.user.tenant_id);
  }

  
  @Get('export/self')
  @ApiOperation({ summary: 'Download your attendance events as CSV' })
  async exportSelf(
    @Req() req: Request,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const userId = (req.user as any).id;
    const userName = `${(req.user as any).first_name || ''} ${(req.user as any).last_name || ''}`.trim();
    const rows: any[] = [];
    const { items } = await this.attendanceService.findEvents(userId, startDate, endDate);
    for (const ev of items) {
      rows.push({
        id: (ev as any).id,
        user_id: userId,
        type: (ev as any).type,
        timestamp: (ev as any).timestamp,
      });
    }
    return sendCsvResponse(res, 'attendance-self.csv', rows);
  }

  @Get('export/team')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_attendance')
  @ApiOperation({ summary: 'Download team attendance as CSV (Manager only)' })
  async exportTeam(
    @Req() req: any,
    @Res() res: Response
  ) {
    const { items } = await this.attendanceService.getTeamAttendance(req.user.id, req.user.tenant_id);
    const rows = (items || []).flatMap((member: any) => {
      const attendance = member.attendance || [];
      return attendance.map((a: any) => ({
        user_id: member.user_id,
        user_name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
        first_name: member.first_name,
        last_name: member.last_name,
        date: a.date,
        check_in: a.checkIn,
        check_out: a.checkOut,
        worked_hours: a.workedHours,
      }));
    });
    return sendCsvResponse(res, 'attendance-team.csv', rows);
  }

  @Get('export/all')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('hr-admin', 'admin', 'system-admin', 'network-admin')
  @Permissions('manage_attendance')
  @ApiOperation({ summary: 'Download all attendance for tenant as CSV (Admin only)' })
  async exportAll(
    @Req() req: any,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const rows: any[] = [];
    const { items } = await this.attendanceService.getAllAttendance(
      req.user.tenant_id,
      startDate,
      endDate
    );
    for (const ev of items) {
      rows.push({
        id: (ev as any).id,
        user_id: (ev as any).user_id,
        user_name: `${(ev as any).user?.first_name || ''} ${(ev as any).user?.last_name || ''}`.trim(),
        timestamp: (ev as any).timestamp,
        type: (ev as any).type,
      });
    }
    return sendCsvResponse(res, 'attendance-all.csv', rows);
  }
}
