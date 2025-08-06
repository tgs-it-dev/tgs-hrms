import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Put,
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
import { UpdateAttendanceDto } from "./dto/update-attendance.dto"
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

@Post()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
async createAttendance(
  @Body() createAttendanceDto: CreateAttendanceDto,
  @Req() req: Request
) {
    console.log('>> req.user =', req.user);
  const userId = (req.user as any).id;

  // Call with 2 arguments: userId and DTO
  return this.attendanceService.create(userId, createAttendanceDto);
}
  @Get()
  @ApiOperation({ summary: 'Get attendance list' })
  findAll(@Query('userId') userId?: string) {
    return this.attendanceService.findAll(userId);
  }

}



