import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { EmployeeProfileService } from "./employee-profile.service"
import { EmployeeProfileDto } from './dto/employee-profile.dto';

@ApiTags('Employee Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeeProfileController {
  constructor(private readonly profileService: EmployeeProfileService) {}

  @Get('users/:user_id/profile')
  @ApiOperation({
    summary:
      'Get full employee profile (designation, department, attendance, leaves)',
  })
  @ApiResponse({
    status: 200,
    type: EmployeeProfileDto,
    description: 'Returns full employee profile with history',
  })
  async getProfile(@Param('user_id') userId: string) {
    return this.profileService.getEmployeeProfileByUserId(userId);
  }
}
