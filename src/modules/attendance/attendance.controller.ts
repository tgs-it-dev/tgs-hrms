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
import { Roles } from 'src/common/guards/company.guard';
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
	
	@Get()
	@ApiOperation({ summary: 'Get daily summaries (latest check-in/out) for a user' })
	findAll(@Query('userId') userId?: string, @Query('page') page?: string, @Query('size') size?: string) {
	 const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
	 const pageSize = Math.max(1, Math.min(100, parseInt(size || '25', 10) || 25));
	 return this.attendanceService.findAll(userId, pageNumber, pageSize);
	}
	
	@Get('events')
	@ApiOperation({ summary: 'Get raw attendance events for a user' })
	async events(@Req() req: Request, @Query('userId') userId?: string, @Query('page') page?: string, @Query('size') size?: string) {
		const id = userId || (req.user as any).id;
		const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
		const pageSize = Math.max(1, Math.min(100, parseInt(size || '25', 10) || 25));
		return this.attendanceService.findEvents(id, pageNumber, pageSize);
	}
	@Get('today')
	@ApiOperation({ summary: 'Get today latest check-in and its matching check-out' })
	async today(@Req() req: Request, @Query('userId') userId?: string) {
		const id = userId || (req.user as any).id;
		return this.attendanceService.getTodaySummary(id);
	}
	@Get('all')
	@UseGuards(RolesGuard)
	@Roles('admin')
	@ApiOperation({ summary: 'Get all attendance records (Admin only)' })
	@ApiResponse({ status: 200, description: 'Returns all attendance records for the tenant' })
	async findAllForAdmin(@Req() req: any, @Query('page') page?: string, @Query('size') size?: string) {
		const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
		const pageSize = Math.max(1, Math.min(100, parseInt(size || '25', 10) || 25));
		return this.attendanceService.getAllAttendance(req.user.tenant_id, pageNumber, pageSize);
	}
}