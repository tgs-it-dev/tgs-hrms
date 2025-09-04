import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { ForbiddenException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';


@ApiTags('Leaves')
@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
   @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new leave request' })
  @ApiResponse({
    status: 201,
    description: 'Leave request created successfully',
  })
  async create(@Body() dto: CreateLeaveDto, @Request() req:any) {
    console.log('>> req.user =', req.user);
    return this.leaveService.createLeave(req.user.id, dto);
  }


  @Get('team')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_team_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get team leave requests (Manager only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns team members leave requests',
    schema: {
      example: {
        items: [
          {
            id: 'leave_id_1',
            user_id: 'user_id_1',
            from_date: '2024-01-15',
            to_date: '2024-01-17',
            reason: 'Family vacation',
            type: 'Vacation',
            status: 'pending',
            applied: '2024-01-10',
            created_at: '2024-01-10T10:30:00Z',
            updated_at: '2024-01-10T10:30:00Z',
            user: {
              id: 'user_id_1',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john.doe@company.com',
              department: 'Engineering',
              position: 'Software Developer'
            }
          }
        ],
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3
      }
    }
  })
  async getTeamLeaves(
    @Request() req: any,
    @Query('page') page?: string,
   
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    
    // Verify the user is a manager
    if (req.user.role !== 'manager') {
      throw new ForbiddenException('Access denied. Manager role required.');
    }

    return this.leaveService.getTeamLeaves(req.user.id, req.user.tenant_id, pageNumber);
  }

  @Get('team/members')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_team_leaves', 'view_team_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get team members who have applied for leave (Manager only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns simple list of team members with leave application status',
    schema: {
      example: {
        teamMembers: [
          {
            user_id: 'user_id_1',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@company.com',
            profile_pic: 'profile_pic_url',
            designation: 'Software Developer',
            department: 'Engineering',
            hasAppliedForLeave: true,
            totalLeaveApplications: 3
          },
          {
            user_id: 'user_id_2',
            first_name: 'Jane',
            last_name: 'Smith',
            email: 'jane.smith@company.com',
            profile_pic: 'profile_pic_url',
            designation: 'UI Designer',
            department: 'Design',
            hasAppliedForLeave: false,
            totalLeaveApplications: 0
          }
        ],
        totalMembers: 2,
        membersWithLeave: 1
      }
    }
  })
  async getTeamMembersWithLeaveApplications(@Request() req: any) {
    // Verify the user is a manager
    if (req.user.role !== 'manager') {
      throw new ForbiddenException('Access denied. Manager role required.');
    }

    return this.leaveService.getTeamMembersWithLeaveApplications(req.user.id, req.user.tenant_id);
  }





  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all leave requests (filtered by user_id)' })
  @ApiResponse({ status: 200, description: 'Returns leave requests' })
  async find(
    @Query('userId') userId?: string,
    @Query('page') page?: string
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.leaveService.getLeaves(userId, pageNumber);
  }


  @Get('all')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('manage_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all leave requests (Admin/Manager only)' })
  @ApiResponse({ status: 200, description: 'Returns all leave requests' })
  async findAllForAdmin(
    @Request() req: any,
    @Query('page') page?: string
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.leaveService.getAllLeaves(req.user.tenant_id, pageNumber);
  }




  @Patch(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin', 'manager')
  @Permissions('manage_leaves', 'approve_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or reject a leave request (Admin/Manager only)' })
  @ApiResponse({
    status: 200,
    description: 'Leave status updated successfully',
  })
  @ApiBody({
    description: 'Status update payload',
    schema: {
      example: {
        status: 'approved', // or 'rejected'
      },
    },
  })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateLeaveDto, @Request() req) {
    return this.leaveService.updateStatus(id, dto.status, req.user.tenant_id);
  }
}









