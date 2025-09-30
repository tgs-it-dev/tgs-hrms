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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { ForbiddenException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Response } from 'express';
import { sendCsvResponse } from 'src/common/utils/csv.util';

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
  async create(@Body() dto: CreateLeaveDto, @Request() req: any) {
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
              position: 'Software Developer',
            },
          },
        ],
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      },
    },
  })
  async getTeamLeaves(@Request() req: any, @Query('page') page?: string) {
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
            totalLeaveApplications: 3,
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
            totalLeaveApplications: 0,
          },
        ],
        totalMembers: 2,
        membersWithLeave: 1,
      },
    },
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
  async find(@Query('userId') userId?: string, @Query('page') page?: string) {
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
  async findAllForAdmin(@Request() req: any, @Query('page') page?: string) {
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

  @Patch(':id/withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Withdraw a leave request (User can only withdraw their own pending requests)',
  })
  @ApiResponse({
    status: 200,
    description: 'Leave request withdrawn successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only withdraw own pending leave requests',
  })
  @ApiResponse({
    status: 404,
    description: 'Leave request not found',
  })
  async withdrawLeave(@Param('id') id: string, @Request() req: any) {
    return this.leaveService.withdrawLeave(id, req.user.id);
  }

  // CSV EXPORTS
  @Get('export/self')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download your leave requests as CSV' })
  async exportSelf(@Request() req: any, @Res() res: Response) {
    let page = 1;
    const rows: any[] = [];
    while (true) {
      const { items, total, limit } = await this.leaveService.getLeaves(req.user.id, page);
      for (const l of items) {
        rows.push({
          id: (l as any).id,
          user_id: req.user.id,
          user_name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
          type: (l as any).type,
          from_date: (l as any).from_date,
          to_date: (l as any).to_date,
          status: (l as any).status,
          reason: (l as any).reason,
          created_at: (l as any).created_at,
        });
      }
      if (!items.length || rows.length >= total) break;
      page += 1;
      if (limit && items.length < limit) break;
    }
    return sendCsvResponse(res, 'leaves-self.csv', rows);
  }

  @Get('export/team')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_team_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download team leave requests as CSV (Manager only)' })
  async exportTeam(@Request() req: any, @Res() res: Response, @Query('page') page?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const { items } = await this.leaveService.getTeamLeaves(req.user.id, req.user.tenant_id, pageNumber);
    const rows = (items || []).map((l: any) => ({
      id: l.id,
      user_id: l.user_id,
      user_name: `${l.user?.first_name || ''} ${l.user?.last_name || ''}`.trim(),
      type: l.type,
      from_date: l.from_date,
      to_date: l.to_date,
      status: l.status,
      reason: l.reason,
      created_at: l.created_at,
    }));
    return sendCsvResponse(res, 'leaves-team.csv', rows);
  }

  @Get('export/all')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download all leave requests for tenant as CSV (Admin only)' })
  async exportAll(@Request() req: any, @Res() res: Response) {
    let page = 1;
    const rows: any[] = [];
    while (true) {
      const { items, total, limit } = await this.leaveService.getAllLeaves(req.user.tenant_id, page);
      for (const l of items) {
        rows.push({
          id: (l as any).id,
          user_id: (l as any).user_id,
          user_name: `${(l as any).user?.first_name || ''} ${(l as any).user?.last_name || ''}`.trim(),
          type: (l as any).type,
          from_date: (l as any).from_date,
          to_date: (l as any).to_date,
          status: (l as any).status,
          created_at: (l as any).created_at,
        });
      }
      if (!items.length || rows.length >= total) break;
      page += 1;
      if (limit && items.length < limit) break;
    }
    return sendCsvResponse(res, 'leaves-all.csv', rows);
  }
}
