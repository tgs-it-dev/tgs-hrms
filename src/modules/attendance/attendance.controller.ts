import {
	Controller,
	Post,
	Get,
	Body,
	Query,
	UseGuards,
	Req,
} from '@nestjs/common';
import {
	ApiTags,
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Request } from 'express';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
	constructor(private readonly attendanceService: AttendanceService) {}
	
	@Post()
	@ApiOperation({ summary: 'Create a check-in/check-out event' })
	async createAttendance(
		@Body() createAttendanceDto: CreateAttendanceDto,
		@Req() req: Request
	) {
		const userId = (req.user as any).id;
		return this.attendanceService.create(userId, createAttendanceDto);
	}
	
	// Daily summaries (latest per type)
	@Get()
	@ApiOperation({ summary: 'Get daily summaries (latest check-in/out) for a user' })
	findAll(@Query('userId') userId?: string, @Query('page') page?: string) {
		const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
		return this.attendanceService.findAll(userId, pageNumber);
	}
	

	@Get('all')
	async findAllForAdmin(
	  @Req() req: any,
	  @Query('page') page?: string,
	  @Query('startDate') startDate?: string,
	  @Query('endDate') endDate?: string
	) {
	  const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
	  return this.attendanceService.getAllAttendance(req.user.tenant_id, pageNumber, startDate, endDate);
	}
	@Get('events')
	async events(
	  @Req() req: Request,
	  @Query('userId') userId?: string,
	  @Query('page') page?: string,
	  @Query('startDate') startDate?: string,
	  @Query('endDate') endDate?: string
	) {
	  const id = userId || (req.user as any).id;
	  const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
	  return this.attendanceService.findEvents(id, pageNumber, startDate, endDate);
	}




	// Raw events for building multiple sessions per day in UI
	// @Get('events')
	// @ApiOperation({ summary: 'Get raw attendance events for a user' })
	// async events(@Req() req: Request, @Query('userId') userId?: string) {
	// 	const id = userId || (req.user as any).id;
	// 	// console.log(userId)
	// 	return this.attendanceService.findEvents(id);
	// }
	
	@Get('today')
	@ApiOperation({ summary: 'Get today latest check-in and its matching check-out' })
	async today(@Req() req: Request, @Query('userId') userId?: string) {
		const id = userId || (req.user as any).id;
		return this.attendanceService.getTodaySummary(id);
	}
	
	// @Get('all')
	// @UseGuards(RolesGuard, PermissionsGuard)
	// @Roles('admin', 'system-admin', 'manager')
	// @Permissions('manage_attendance')
	// @ApiOperation({ summary: 'Get all attendance records (Admin/Manager only)' })
	// @ApiResponse({ status: 200, description: 'Returns all attendance records for the tenant' })
	// async findAllForAdmin(@Req() req: any, @Query('page') page?: string) {
	// 	const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
	// 	return this.attendanceService.getAllAttendance(req.user.tenant_id, pageNumber);
	// }

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
                workedHours: 8.5
              }
            ],
            totalDaysWorked: 20,
            totalHoursWorked: 160.5
          }
        ],
        total: 5,
        page: 1,
        limit: 10,
        totalPages: 1
      }
    }
  })
  async getTeamAttendance(@Req() req: any, @Query('page') page?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.attendanceService.getTeamAttendance(req.user.id, req.user.tenant_id, pageNumber);
  }
}