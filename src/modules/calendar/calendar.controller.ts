import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { TeamCalendarQueryDto } from './dto/team-calendar-query.dto';
import { AuthenticatedRequest } from '../../common/types/request.types';
import { UserRole } from '../../common/constants/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Calendar')
@Controller('calendar')
@ApiBearerAuth()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SYSTEM_ADMIN,
    UserRole.ADMIN,
    UserRole.HR_ADMIN,
    UserRole.NETWORK_ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Team availability calendar',
    description:
      'Unified view of leave, WFH, and attendance per member for a date range. ' +
      'Leave takes priority over WFH, which takes priority over attendance-derived status. ' +
      'System-admins must pass tenantId to specify which org to query.',
  })
  @ApiQuery({ name: 'from', type: String, example: '2025-06-01' })
  @ApiQuery({ name: 'to', type: String, example: '2025-06-30' })
  @ApiQuery({ name: 'teamId', type: String, required: false })
  @ApiQuery({
    name: 'tenantId',
    type: String,
    required: false,
    description: 'Required for system-admin. Ignored for all other roles.',
  })
  @ApiQuery({
    name: 'timezone',
    type: String,
    required: false,
    example: 'Asia/Karachi',
    description:
      'IANA timezone for date grouping. Falls back to X-Timezone header, then UTC.',
  })
  @ApiHeader({
    name: 'X-Timezone',
    required: false,
    description:
      'IANA timezone (e.g. Asia/Karachi). Overridden by the timezone query param.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of members with date-status entries',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date' },
                status: {
                  type: 'string',
                  enum: [
                    'WFH',
                    'ON_LEAVE',
                    'PRESENT',
                    'ABSENT',
                    'WORK_LATE',
                    'WEEKEND_WORK',
                  ],
                },
              },
            },
          },
        },
      },
    },
  })
  async getCalendar(
    @Request() req: AuthenticatedRequest,
    @Query() query: TeamCalendarQueryDto,
    @Headers('x-timezone') tzHeader?: string,
  ) {
    const role = req.user.role;
    const isSystemAdmin = role === UserRole.SYSTEM_ADMIN;

    if (isSystemAdmin && !query.tenantId) {
      throw new BadRequestException('tenantId is required for system-admin');
    }

    const tenantId = isSystemAdmin ? query.tenantId! : req.user.tenant_id;

    // System-admin and admin roles must always provide a teamId
    const needsTeamId =
      role === UserRole.SYSTEM_ADMIN ||
      role === UserRole.ADMIN ||
      role === UserRole.HR_ADMIN ||
      role === UserRole.NETWORK_ADMIN;

    if (needsTeamId && !query.teamId) {
      throw new BadRequestException('teamId is required for admin roles');
    }

    // Manager role may also provide teamId — scoping is enforced server-side
    // Employee role must NOT provide teamId — ignored server-side

    const timezone = this.calendarService.resolveTimezone(
      query.timezone,
      tzHeader,
    );

    return this.calendarService.getTeamCalendar(
      tenantId,
      query.from,
      query.to,
      query.teamId,
      timezone,
      req.user.id,
      role,
    );
  }
}
