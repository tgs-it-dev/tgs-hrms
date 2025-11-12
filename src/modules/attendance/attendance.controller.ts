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
import { AttendanceType } from 'src/common/constants/enums';

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
    const { items } = await this.attendanceService.findEvents(userId, startDate, endDate);
    
    // Group events by date and combine check-in/check-out
    const groupedByDate: Record<string, { checkIn?: any; checkOut?: any }> = {};
    const checkIns: any[] = [];
    const checkOuts: any[] = [];
    
    for (const ev of items) {
      if (ev.type === AttendanceType.CHECK_IN) {
        checkIns.push(ev);
      } else if (ev.type === AttendanceType.CHECK_OUT) {
        checkOuts.push(ev);
      }
    }
    
    // Match check-ins with check-outs
    for (const checkIn of checkIns) {
      const date = checkIn.timestamp.toISOString().split('T')[0];
      const matchingCheckOut = checkOuts.find(
        checkout => checkout.timestamp > checkIn.timestamp
      );
      
      if (!groupedByDate[date]) {
        groupedByDate[date] = {};
      }
      
      // Keep the latest check-in and its matching check-out for each date
      if (!groupedByDate[date].checkIn || 
          checkIn.timestamp > (groupedByDate[date].checkIn?.timestamp || new Date(0))) {
        groupedByDate[date].checkIn = checkIn;
        groupedByDate[date].checkOut = matchingCheckOut;
      }
    }
    
    // Convert to CSV rows
    const rows: any[] = [];
    for (const [date, { checkIn, checkOut }] of Object.entries(groupedByDate)) {
      let workedHours = 0;
      if (checkIn && checkOut && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)) {
        const diffMs = new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
        workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }
      
      rows.push({
        date: date,
        user_id: userId,
        user_name: userName,
        check_in: checkIn?.timestamp || '',
        check_out: (checkOut && checkIn && new Date(checkOut.timestamp) > new Date(checkIn.timestamp))
          ? checkOut.timestamp
          : '',
        worked_hours: workedHours,
      });
    }
    
    // Sort by date descending
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
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
    const { items } = await this.attendanceService.getAllAttendance(
      req.user.tenant_id,
      startDate,
      endDate
    );
    
    // Group events by user_id and date, then combine check-in/check-out
    const groupedByUserAndDate: Record<string, Record<string, { checkIn?: any; checkOut?: any }>> = {};
    
    // First, group by user_id
    const userGroups: Record<string, any[]> = {};
    for (const ev of items) {
      const userId = ev.user_id;
      if (!userGroups[userId]) {
        userGroups[userId] = [];
      }
      userGroups[userId].push(ev);
    }
    
    // For each user, group by date and match check-ins with check-outs
    for (const [userId, userEvents] of Object.entries(userGroups)) {
      const checkIns = userEvents.filter(e => e.type === AttendanceType.CHECK_IN);
      const checkOuts = userEvents.filter(e => e.type === AttendanceType.CHECK_OUT);
      
      if (!groupedByUserAndDate[userId]) {
        groupedByUserAndDate[userId] = {};
      }
      
      for (const checkIn of checkIns) {
        const date = checkIn.timestamp.toISOString().split('T')[0];
        const matchingCheckOut = checkOuts.find(
          checkout => checkout.timestamp > checkIn.timestamp
        );
        
        if (!groupedByUserAndDate[userId][date]) {
          groupedByUserAndDate[userId][date] = {};
        }
        
        // Keep the latest check-in and its matching check-out for each date
        if (!groupedByUserAndDate[userId][date].checkIn || 
            checkIn.timestamp > (groupedByUserAndDate[userId][date].checkIn?.timestamp || new Date(0))) {
          groupedByUserAndDate[userId][date].checkIn = checkIn;
          groupedByUserAndDate[userId][date].checkOut = matchingCheckOut;
        }
      }
    }
    
    // Convert to CSV rows
    const rows: any[] = [];
    for (const [userId, dateGroups] of Object.entries(groupedByUserAndDate)) {
      const user = items.find(e => e.user_id === userId)?.user;
      const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '';
      
      for (const [date, { checkIn, checkOut }] of Object.entries(dateGroups)) {
        let workedHours = 0;
        if (checkIn && checkOut && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)) {
          const diffMs = new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
          workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        }
        
        rows.push({
          date: date,
          user_id: userId,
          user_name: userName,
          check_in: checkIn?.timestamp || '',
          check_out: (checkOut && checkIn && new Date(checkOut.timestamp) > new Date(checkIn.timestamp))
            ? checkOut.timestamp
            : '',
          worked_hours: workedHours,
        });
      }
    }
    
    // Sort by date descending, then by user_name
    rows.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.user_name.localeCompare(b.user_name);
    });
    
    return sendCsvResponse(res, 'attendance-all.csv', rows);
  }
}
