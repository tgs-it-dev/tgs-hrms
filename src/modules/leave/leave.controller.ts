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
  ApiBody
} from '@nestjs/swagger';
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



  //  @Get('all')
  // @UseGuards(RolesGuard)
  // @Roles('admin')
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Get all leave requests (Admin only)' })
  // @ApiResponse({ status: 200, description: 'Returns all leave requests' })
  // async findAllForAdmin(@Request() req: any, @Query('page') page?: string) {
  //   const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
  //   return this.leaveService.getAllLeaves(req.user.tenant_id, pageNumber);
  // }

  // @Get()
  //  @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Get all leave requests (filtered by user_id)' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Returns leave requests',
  // })
  // async find(@Query('userId') userId?: string, @Query('page') page?: string) {
  //   const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
  //   return this.leaveService.getLeaves(userId, pageNumber);
  // }

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
  @Roles('admin', 'system-admin', 'manager')
  @Permissions('manage_leaves', 'manage_team_leaves')
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





