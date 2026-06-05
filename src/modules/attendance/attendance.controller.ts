import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Headers,
  UseGuards,
  Req,
  Res,
  Param,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import {
  ApproveCheckInDto,
  BulkApproveCheckInDto,
} from './dto/approve-checkin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../common/types/request.types';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Response } from 'express';
import { sendCsvResponse } from 'src/common/utils/csv.util';
import { AttendanceType, UserRole } from 'src/common/constants/enums';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IANA_TZ_REGEX = /^[A-Za-z_]+(?:\/[A-Za-z_]+)*$/;

interface AttendanceEvent {
  type: AttendanceType;
  timestamp: Date;
  user_id?: string;
  date?: string;
  approval_status?: string;
  user?: {
    first_name?: string;
    last_name?: string;
    employees: AttendanceEmployee[];
  };
}

interface AttendanceEmployee {
  first_name?: string;
  last_name?: string;
  team?: { name?: string };
}

interface AttendanceRecord {
  date?: string;
  checkIn?: Date | string | null;
  checkOut?: Date | string | null;
  workedHours?: number;
}

interface TeamMemberAttendance {
  first_name?: string;
  last_name?: string;
  attendance?: AttendanceRecord[];
}

interface EmployeeAttendance {
  first_name?: string;
  last_name?: string;
  email?: string;
  totalDaysWorked?: number;
  totalHoursWorked?: number;
  attendance?: AttendanceRecord[];
}

interface TenantAttendance {
  tenant_name?: string;
  tenant_status?: string;
  employees?: EmployeeAttendance[];
}

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a check-in/check-out event' })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Location outside geofence or missing required fields',
  })
  @ApiResponse({
    status: 201,
    description: 'Check-in/check-out created successfully',
  })
  async createAttendance(
    @Body() createAttendanceDto: CreateAttendanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    return this.attendanceService.create(userId, createAttendanceDto, tenantId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get daily summaries (latest check-in/out) for a user',
  })
  findAll(@Query('userId') userId?: string) {
    return this.attendanceService.findAll(userId);
  }

  @Get('all')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('hr-admin', 'admin', 'system-admin', 'network-admin')
  @Permissions('manage_attendance')
  async findAllForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getAllAttendance(
      req.user.tenant_id,
      startDate,
      endDate,
    );
  }

  @Get('system/all')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('system-admin')
  @Permissions('manage_attendance')
  @ApiOperation({
    summary: 'Get all attendance grouped by tenant (System-Admin only)',
    description:
      'Returns attendance data grouped by tenant. Can filter by specific tenant, start date, and end date.',
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    type: String,
    description:
      'Optional tenant ID to filter attendance for a specific tenant',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description:
      'Optional start date filter (ISO date string, e.g., 2024-01-01)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Optional end date filter (ISO date string, e.g., 2024-01-31)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns attendance grouped by tenant with employee details',
    schema: {
      example: {
        tenants: [
          {
            tenant_id: 'uuid-here',
            tenant_name: 'Company ABC',
            tenant_status: 'active',
            employees: [
              {
                user_id: 'user-uuid',
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@company.com',
                profile_pic: 'url',
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
            totalEmployees: 5,
            totalAttendanceRecords: 100,
          },
        ],
        totalTenants: 1,
      },
    },
  })
  async getAttendanceByTenant(
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getAttendanceByTenant(
      tenantId,
      startDate,
      endDate,
    );
  }
  @Get('events')
  @UseGuards(RolesGuard)
  @Roles(
    'employee',
    'manager',
    'hr-admin',
    'admin',
    'system-admin',
    'network-admin',
  )
  @ApiOperation({ summary: 'Get attendance events for a user' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description:
      'User ID to filter events. If not provided, uses logged-in user ID. System-admin can provide any user ID.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO date string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO date string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns attendance events for the specified user',
  })
  async events(
    @Req() req: AuthenticatedRequest,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // For system-admin, allow them to query any userId
    // For other roles, default to their own userId if not provided
    const userRole = req.user?.role;
    const id =
      userId || (userRole === 'system-admin' ? undefined : req.user.id);
    return this.attendanceService.findEvents(id, startDate, endDate);
  }

  @Get('today')
  @ApiOperation({
    summary: 'Get today latest check-in and its matching check-out',
  })
  async today(
    @Req() req: AuthenticatedRequest,
    @Query('userId') userId?: string,
  ) {
    const id = userId || req.user.id;
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
                checkInId: 'check-in-uuid',
                checkIn: '2024-01-15T09:00:00Z',
                checkOutId: 'check-out-uuid',
                checkOut: '2024-01-15T17:30:00Z',
                workedHours: 8.5,
                approvalStatus: 'pending',
                approvalRemarks: null,
                approvedBy: null,
                approvedAt: null,
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
  async getTeamAttendance(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getTeamAttendance(
      req.user.id,
      req.user.tenant_id,
      startDate,
      endDate,
    );
  }

  @Get('export/self')
  @ApiOperation({
    summary: 'Download your own attendance as CSV',
    description:
      "Exports only the logged-in user's attendance. For admin to export all employees' attendance, use GET /attendance/export/all with date filters instead.",
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description:
      'Optional start date filter (ISO date string, e.g., 2024-01-01)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Optional end date filter (ISO date string, e.g., 2024-01-31)',
  })
  async exportSelf(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId = req.user.id;
    let userName =
      `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();
    if (!userName) {
      userName = await this.attendanceService.getUserDisplayName(userId);
    }
    const { items } = await this.attendanceService.findEvents(
      userId,
      startDate,
      endDate,
    );

    // Group events by date and combine check-in/check-out
    const groupedByDate: Record<
      string,
      { checkIn?: AttendanceEvent; checkOut?: AttendanceEvent }
    > = {};
    const checkIns: AttendanceEvent[] = [];
    const checkOuts: AttendanceEvent[] = [];

    for (const ev of items) {
      if (ev.type === AttendanceType.CHECK_IN) {
        checkIns.push(ev as AttendanceEvent);
      } else if (ev.type === AttendanceType.CHECK_OUT) {
        checkOuts.push(ev as AttendanceEvent);
      }
    }

    // Match check-ins with check-outs
    for (const checkIn of checkIns) {
      const date = checkIn.timestamp.toISOString().split('T')[0];
      const matchingCheckOut = checkOuts.find(
        (checkout) => checkout.timestamp > checkIn.timestamp,
      );

      if (!groupedByDate[date]) {
        groupedByDate[date] = {};
      }

      // Keep the latest check-in and its matching check-out for each date
      if (
        !groupedByDate[date].checkIn ||
        checkIn.timestamp >
          (groupedByDate[date].checkIn?.timestamp || new Date(0))
      ) {
        groupedByDate[date].checkIn = checkIn;
        groupedByDate[date].checkOut = matchingCheckOut;
      }
    }

    // Convert to CSV rows
    const rows: Record<string, unknown>[] = [];
    for (const [date, { checkIn, checkOut }] of Object.entries(groupedByDate)) {
      let workedHours = 0;
      if (
        checkIn &&
        checkOut &&
        new Date(checkOut.timestamp) > new Date(checkIn.timestamp)
      ) {
        const diffMs =
          new Date(checkOut.timestamp).getTime() -
          new Date(checkIn.timestamp).getTime();
        workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      rows.push({
        date: date,
        user_name: userName,
        check_in: checkIn?.timestamp || '',
        check_out:
          checkOut &&
          checkIn &&
          new Date(checkOut.timestamp) > new Date(checkIn.timestamp)
            ? checkOut.timestamp
            : '',
        worked_hours: workedHours,
      });
    }

    // Sort by date descending
    rows.sort(
      (a, b) =>
        new Date(b.date as string).getTime() -
        new Date(a.date as string).getTime(),
    );

    const csvRows =
      rows.length > 0
        ? rows
        : [
            {
              date: '',
              user_name: '',
              check_in: '',
              check_out: '',
              worked_hours: '',
            },
          ];
    return sendCsvResponse(res, 'attendance-self.csv', csvRows);
  }

  @Get('export/team')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_attendance')
  @ApiOperation({ summary: 'Download team attendance as CSV (Manager only)' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description:
      'Optional start date filter (ISO date string, e.g., 2024-01-01)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Optional end date filter (ISO date string, e.g., 2024-01-31)',
  })
  async exportTeam(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { items } = await this.attendanceService.getTeamAttendance(
      req.user.id,
      req.user.tenant_id,
      startDate,
      endDate,
    );
    const rows = (items as TeamMemberAttendance[]).flatMap((member) => {
      const attendance = member.attendance || [];
      return attendance.map((a) => ({
        user_name:
          `${member.first_name || ''} ${member.last_name || ''}`.trim(),
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
  @ApiOperation({
    summary: 'Download all attendance for tenant as CSV (Admin only)',
    description:
      "Use this API for admin/HR to export all employees' attendance for the tenant. Date filters (startDate, endDate) apply. For own attendance only, use GET /attendance/export/self instead.",
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description:
      'Start date filter (e.g. 2026-01-01). Applied as UTC start of day.',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description:
      'End date filter (e.g. 2026-02-28). Applied as UTC end of day.',
  })
  async exportAll(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Fetch all records in batches to ensure we get everything
    const allItems: any[] = [];
    const batchSize = 1000;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.attendanceService.getAllAttendanceBatch(
        req.user.tenant_id,
        startDate,
        endDate,
        skip,
        batchSize,
      );

      if (batch.length > 0) {
        allItems.push(...batch);
        skip += batchSize;
        hasMore = batch.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    const groupedByUserAndDate: Record<
      string,
      Record<string, { checkIn?: AttendanceEvent; checkOut?: AttendanceEvent }>
    > = {};

    // Store user info for later use
    const userInfoMap: Record<
      string,
      { first_name?: string; last_name?: string; team_name?: string }
    > = {};

    const userGroups: Record<string, AttendanceEvent[]> = {};
    for (const ev of allItems as AttendanceEvent[]) {
      const userId = ev.user_id ?? '';
      if (!userGroups[userId]) {
        userGroups[userId] = [];
      }
      userGroups[userId].push(ev);

      // Store user info
      if (ev.user && !userInfoMap[userId]) {
        const teamName = ev.user.employees?.[0]?.team?.name ?? '';
        userInfoMap[userId] = { ...ev.user, team_name: teamName };
      }
    }

    for (const [userId, userEvents] of Object.entries(userGroups)) {
      const checkIns = userEvents.filter(
        (e) => e.type === AttendanceType.CHECK_IN,
      );
      const checkOuts = userEvents.filter(
        (e) => e.type === AttendanceType.CHECK_OUT,
      );

      if (!groupedByUserAndDate[userId]) {
        groupedByUserAndDate[userId] = {};
      }

      for (const checkIn of checkIns) {
        const date = checkIn.timestamp.toISOString().split('T')[0];
        const matchingCheckOut = checkOuts.find(
          (checkout) => checkout.timestamp > checkIn.timestamp,
        );

        if (!groupedByUserAndDate[userId][date]) {
          groupedByUserAndDate[userId][date] = {};
        }

        if (
          !groupedByUserAndDate[userId][date].checkIn ||
          checkIn.timestamp >
            (groupedByUserAndDate[userId][date].checkIn?.timestamp ||
              new Date(0))
        ) {
          groupedByUserAndDate[userId][date].checkIn = checkIn;
          groupedByUserAndDate[userId][date].checkOut = matchingCheckOut;
        }
      }
    }

    const rows: Record<string, unknown>[] = [];
    for (const [userId, dateGroups] of Object.entries(groupedByUserAndDate)) {
      const user = userInfoMap[userId];
      const userName = user
        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
        : '';

      for (const [date, { checkIn, checkOut }] of Object.entries(dateGroups)) {
        let workedHours = 0;
        if (
          checkIn &&
          checkOut &&
          new Date(checkOut.timestamp) > new Date(checkIn.timestamp)
        ) {
          const diffMs =
            new Date(checkOut.timestamp).getTime() -
            new Date(checkIn.timestamp).getTime();
          workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        }

        rows.push({
          date: date,
          employee_name: userName,
          team_name: userInfoMap[userId]?.team_name ?? '',
          check_in: checkIn?.timestamp || '',
          check_out:
            checkOut &&
            checkIn &&
            new Date(checkOut.timestamp) > new Date(checkIn.timestamp)
              ? checkOut.timestamp
              : '',
          worked_hours: workedHours,
          status: checkIn?.approval_status ?? '',
        });
      }
    }

    rows.sort((a, b) => {
      const dateCompare =
        new Date(b.date as string).getTime() -
        new Date(a.date as string).getTime();
      if (dateCompare !== 0) return dateCompare;
      return ((a.employee_name as string) || '').localeCompare(
        (b.employee_name as string) || '',
      );
    });

    // Headers even when no data (e.g. no records in date range)
    const csvRows =
      rows.length > 0
        ? rows
        : [
            {
              date: '',
              employee_name: '',
              team_name: '',
              check_in: '',
              check_out: '',
              worked_hours: '',
              status: '',
            },
          ];
    return sendCsvResponse(res, 'attendance-all.csv', csvRows);
  }

  @Get('export/system')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('system-admin')
  @Permissions('manage_attendance')
  @ApiOperation({
    summary: 'Download attendance for all tenants as CSV (System-admin only)',
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    type: String,
    description:
      'Optional tenant ID to filter attendance for a specific tenant',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description:
      'Optional start date filter (ISO date string, e.g., 2024-01-01)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Optional end date filter (ISO date string, e.g., 2024-01-31)',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description:
      'Optional employee name filter (partial match on first/last name)',
  })
  async exportSystem(
    @Res() res: Response,
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('name') name?: string,
  ) {
    const { tenants } = await this.attendanceService.getAttendanceByTenant(
      tenantId,
      startDate,
      endDate,
      name,
    );

    const rows: Record<string, unknown>[] = [];

    for (const tenant of (tenants as TenantAttendance[]) || []) {
      for (const employee of tenant.employees || []) {
        const userName =
          `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
        for (const record of employee.attendance || []) {
          rows.push({
            tenant_name: tenant.tenant_name,
            tenant_status: tenant.tenant_status,
            user_name: userName,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            date: record.date,
            check_in: record.checkIn,
            check_out: record.checkOut,
            worked_hours: record.workedHours,
            total_days_worked: employee.totalDaysWorked,
            total_hours_worked: employee.totalHoursWorked,
          });
        }
      }
    }

    rows.sort((a, b) => {
      const tenantCompare = ((a.tenant_name as string) || '').localeCompare(
        (b.tenant_name as string) || '',
      );
      if (tenantCompare !== 0) return tenantCompare;
      const userCompare = ((a.user_name as string) || '').localeCompare(
        (b.user_name as string) || '',
      );
      if (userCompare !== 0) return userCompare;
      return (
        new Date(b.date as string).getTime() -
        new Date(a.date as string).getTime()
      );
    });

    const filename = tenantId
      ? `attendance-tenant-${tenantId}.csv`
      : 'attendance-all-tenants.csv';
    return sendCsvResponse(res, filename, rows);
  }

  @Get('export/present-days')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('hr-admin', 'admin', 'system-admin', 'network-admin')
  @Permissions('manage_attendance')
  @ApiOperation({
    summary: 'Download total present days per employee as CSV',
    description:
      "Returns a CSV with each employee's total present days (distinct dates with a check-in) within the given date range. " +
      'Admins see their own tenant. System-admin must supply tenantId to scope the export to a specific tenant.',
  })
  @ApiHeader({
    name: 'X-Timezone',
    required: false,
    description:
      'IANA timezone (e.g. Asia/Karachi). Overridden by the `timezone` query param if both are provided.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (e.g. 2026-05-01)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (e.g. 2026-05-31)',
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    type: String,
    description: 'Tenant UUID (required for system-admin)',
  })
  @ApiQuery({
    name: 'timezone',
    required: false,
    type: String,
    description:
      'IANA timezone for date grouping (e.g. Asia/Karachi). Falls back to X-Timezone header, then UTC.',
  })
  async exportPresentDays(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Headers('x-timezone') tzHeader?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantId?: string,
    @Query('timezone') timezone?: string,
  ) {
    const isSystemAdmin = req.user.role === UserRole.SYSTEM_ADMIN;

    if (isSystemAdmin && !tenantId) {
      throw new BadRequestException(
        'tenantId is required for system-admin exports',
      );
    }

    if (tenantId && !UUID_REGEX.test(tenantId)) {
      throw new BadRequestException('tenantId must be a valid UUID');
    }

    const resolvedTenantId = isSystemAdmin ? tenantId : req.user.tenant_id;
    const resolvedTimezone =
      [timezone, tzHeader].find((tz) => tz && IANA_TZ_REGEX.test(tz)) ?? 'UTC';

    const rows = await this.attendanceService.getPresentDaysSummary(
      resolvedTenantId,
      startDate,
      endDate,
      resolvedTimezone,
    );

    const filename = resolvedTenantId
      ? `present-days-${resolvedTenantId}.csv`
      : 'present-days-all-tenants.csv';

    return sendCsvResponse(res, filename, rows);
  }

  @Get('team/today')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_attendance')
  @ApiOperation({
    summary: "Get today's check-ins for team members (Manager only)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns today's check-ins for team members",
    schema: {
      example: {
        items: [
          {
            id: 'check-in-uuid',
            user_id: 'user-uuid',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@company.com',
            profile_pic: 'profile_pic_url',
            designation: 'Software Developer',
            department: 'Engineering',
            check_in_time: '2024-01-15T09:00:00Z',
            approval_status: 'pending',
            approved_by: null,
            approved_at: null,
            approval_remarks: null,
          },
        ],
        total: 5,
      },
    },
  })
  async getTodayTeamCheckIns(@Req() req: AuthenticatedRequest) {
    return this.attendanceService.getTodayTeamCheckIns(
      req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('team/today/attendance')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_attendance')
  @ApiOperation({
    summary:
      "Get today's attendance (check-in/out) for team members who marked attendance today (Manager only)",
  })
  @ApiResponse({
    status: 200,
    description:
      "Returns today's attendance for team members who have marked attendance today",
    schema: {
      example: {
        items: [
          {
            user_id: 'user-uuid',
            first_name: 'Jane',
            last_name: 'Doe',
            email: 'jane.doe@company.com',
            profile_pic: 'profile_pic_url',
            designation: 'Software Developer',
            department: 'Engineering',
            attendance: [
              {
                date: '2026-01-21',
                checkIn: '2026-01-21T09:00:00Z',
                checkOut: '2026-01-21T17:30:00Z',
                workedHours: 8.5,
              },
            ],
            totalDaysWorked: 1,
            totalHoursWorked: 8.5,
          },
        ],
        total: 3,
      },
    },
  })
  async getTodayTeamAttendance(@Req() req: AuthenticatedRequest) {
    const today = new Date().toISOString().split('T')[0];
    const result = await this.attendanceService.getTeamAttendance(
      req.user.id,
      req.user.tenant_id,
      today,
      today,
    );

    // Filter to only include team members who have marked attendance today (at least check-in)
    const filteredItems = result.items.filter(
      (member) =>
        member.attendance &&
        member.attendance.length > 0 &&
        member.attendance.some((a) => a.checkIn !== null),
    );

    return {
      items: filteredItems,
      total: filteredItems.length,
    };
  }

  @Patch('check-in/:id/approve')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_attendance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a single check-in (Manager only)' })
  @ApiParam({
    name: 'id',
    description: 'Check-in attendance record ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Check-in approved successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - Only manager can approve their team members' check-ins",
  })
  @ApiResponse({
    status: 404,
    description: 'Check-in record not found',
  })
  async approveCheckIn(
    @Param('id') id: string,
    @Body() dto: ApproveCheckInDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceService.approveCheckIn(
      id,
      req.user.id,
      req.user.tenant_id,
      dto.remarks,
    );
  }

  @Patch('check-in/:id/disapprove')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_attendance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disapprove a single check-in (Manager only)' })
  @ApiParam({
    name: 'id',
    description: 'Check-in attendance record ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Check-in disapproved successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - Only manager can disapprove their team members' check-ins",
  })
  @ApiResponse({
    status: 404,
    description: 'Check-in record not found',
  })
  async disapproveCheckIn(
    @Param('id') id: string,
    @Body() dto: ApproveCheckInDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceService.disapproveCheckIn(
      id,
      req.user.id,
      req.user.tenant_id,
      dto.remarks,
    );
  }

  @Patch('check-in/approve-all')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_attendance')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Approve all today's check-ins for team members at once (Manager only)",
  })
  @ApiResponse({
    status: 200,
    description: 'All check-ins approved successfully',
    schema: {
      example: {
        approved: 10,
        items: [],
      },
    },
  })
  async approveAllCheckIns(
    @Body() dto: BulkApproveCheckInDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceService.approveAllCheckIns(
      req.user.id,
      req.user.tenant_id,
      dto.remarks,
    );
  }

  @Patch('check-in/disapprove-all')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_attendance')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Disapprove all today's check-ins for team members at once (Manager only)",
  })
  @ApiResponse({
    status: 200,
    description: 'All check-ins disapproved successfully',
    schema: {
      example: {
        disapproved: 10,
        items: [],
      },
    },
  })
  async disapproveAllCheckIns(
    @Body() dto: BulkApproveCheckInDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceService.disapproveAllCheckIns(
      req.user.id,
      req.user.tenant_id,
      dto.remarks,
    );
  }
}
