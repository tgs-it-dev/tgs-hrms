import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LeaveTypeService } from './leave-type.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Leave Types')
@Controller('leave-types')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('hr-admin', 'system-admin')
@Permissions('manage_leave_types')
export class LeaveTypeController {
  constructor(private readonly leaveTypeService: LeaveTypeService) {}

  @Post()
  @Roles('hr-admin', 'system-admin', 'Admin')
@Permissions('manage_leave_types')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new leave type' })
  @ApiResponse({
    status: 201,
    description: 'Leave type created successfully',
  })
  async create(@Body() createLeaveTypeDto: CreateLeaveTypeDto, @Request() req: any) {
    return this.leaveTypeService.create(createLeaveTypeDto, req.user.tenant_id, req.user.id);
  }

  @Get()
  @Roles('hr-admin', 'system-admin','manager', 'employee', 'admin' , 'network-admin')
@Permissions('manage_leave_types', 'view_leave_types','request_leave')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of leave types (filter by tenant)' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of leave types',
  })
  async findAll(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = Math.max(1, parseInt(limit || '10', 10) || 10);
    return this.leaveTypeService.findAll(req.user.tenant_id, pageNumber, limitNumber);
  }

  @Get(':id')
  @Roles('hr-admin', 'system-admin','manager', 'employee', 'admin' , 'network-admin')
@Permissions('manage_leave_types', 'view_leave_types')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details of a specific leave type' })
  @ApiResponse({
    status: 200,
    description: 'Returns leave type details',
  })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.leaveTypeService.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  @Roles('hr-admin', 'system-admin')
@Permissions('manage_leave_types')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update leave type details' })
  @ApiResponse({
    status: 200,
    description: 'Leave type updated successfully',
  })
  async update(@Param('id') id: string, @Body() updateLeaveTypeDto: UpdateLeaveTypeDto, @Request() req: any) {
    return this.leaveTypeService.update(id, updateLeaveTypeDto, req.user.tenant_id);
  }

  @Delete(':id')
  @Roles('hr-admin', 'system-admin')
@Permissions('manage_leave_types')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete or deactivate leave type' })
  @ApiResponse({
    status: 200,
    description: 'Leave type deactivated successfully',
  })
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.leaveTypeService.remove(id, req.user.tenant_id);
    return { message: 'Leave type deactivated successfully' };
  }
}
