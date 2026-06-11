import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  Request,
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

@ApiTags('Calendar')
@Controller('calendar')
@ApiBearerAuth()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
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
  getCalendar(
    @Request() req: AuthenticatedRequest,
    @Query() query: TeamCalendarQueryDto,
    @Headers('x-timezone') tzHeader?: string,
  ) {
    const isSystemAdmin = req.user.role === UserRole.SYSTEM_ADMIN;

    if (isSystemAdmin && !query.tenantId) {
      throw new BadRequestException('tenantId is required for system-admin');
    }

    const tenantId = isSystemAdmin ? query.tenantId! : req.user.tenant_id;
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
    );
  }
}
