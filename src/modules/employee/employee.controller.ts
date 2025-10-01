import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Query,
  Patch,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/company.deorator';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveService } from '../leave/leave.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Response } from 'express';
import { sendCsvResponse } from '../../common/utils/csv.util';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
@Controller('employees')
export class EmployeeController {
  constructor(
    private readonly service: EmployeeService,
    private readonly attendanceService: AttendanceService,
    private readonly leaveService: LeaveService
  ) {}

  @Post('manager')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Create a new manager employee' })
  @ApiResponse({
    status: 201,
    description: 'Manager created successfully with manager role assigned',
  })
  async createManager(@TenantId() tenant_id: string, @Body() createEmployeeDto: CreateEmployeeDto) {
    return this.service.createManager(tenant_id, createEmployeeDto);
  }

  @Patch(':id/promote-to-manager')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Promote an existing employee to manager role' })
  @ApiResponse({
    status: 200,
    description: 'Employee promoted to manager successfully',
  })
  @ApiParam({ name: 'id', description: 'Employee ID to promote' })
  async promoteToManager(@TenantId() tenant_id: string, @Param('id') id: string) {
    return this.service.promoteToManager(tenant_id, id);
  }

  @Patch(':id/demote-to-employee')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Demote a manager back to employee role' })
  @ApiResponse({
    status: 200,
    description: 'Manager demoted to employee successfully',
  })
  @ApiParam({ name: 'id', description: 'Manager ID to demote' })
  async demoteToEmployee(@TenantId() tenant_id: string, @Param('id') id: string) {
    return this.service.demoteToEmployee(tenant_id, id);
  }

  @Post()
  @Roles('admin', 'system-admin')
  @Permissions('manage_employees')
  @ApiOperation({ summary: 'Create employee by assigning user to designation' })
  @ApiResponse({ status: 201, description: 'Employee created.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid user or designation.',
    schema: {
      example: {
        message: 'Invalid user for this tenant.',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'User is already an employee in this tenant.',
    schema: {
      example: {
        message: 'User is already an employee in this tenant.',
        error: 'Conflict',
        statusCode: 409,
      },
    },
  })
  async create(@TenantId() tenant_id: string, @Body() dto: CreateEmployeeDto) {
    return this.service.create(tenant_id, dto);
  }

  @Put(':id')
  @Roles('admin', 'system-admin')
  @Permissions('manage_employees')
  @ApiOperation({ summary: 'Update employee designation' })
  @ApiResponse({ status: 200, description: 'Employee updated.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid designation.',
    schema: {
      example: {
        message: 'Invalid designation ID',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found.',
    schema: {
      example: {
        message: 'Employee not found',
        error: 'Not Found',
        statusCode: 404,
      },
    },
  })
  async update(
    @TenantId() tenant_id: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto
  ) {
    return this.service.update(tenant_id, id, dto);
  }

  @Get()
  @Roles('admin', 'system-admin')
  @Permissions('manage_employees')
  @ApiOperation({
    summary: 'List all employees for tenant with optional designation and department filters',
  })
  @ApiQuery({
    name: 'designation_id',
    required: false,
    description: 'Filter employees by designation ID',
    example: '6b99992a-d8ef-4c0c-91dc-2a23e391ac9c',
  })
  @ApiQuery({
    name: 'department_id',
    required: false,
    description: 'Filter employees by department ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiQuery({
    name: 'page',
    required: true,
    description: 'Page number for pagination (required)',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of employees matching optional filters.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters.',
    schema: {
      example: {
        message: 'Invalid designation ID or department ID',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  async findAll(@TenantId() tenant_id: string, @Query() query: EmployeeQueryDto) {
    const pageNumber = Math.max(1, parseInt(query.page, 10) || 1);
    return this.service.findAll(tenant_id, query, pageNumber);
  }

  // CSV EXPORTS
  @Get('export')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Download employees list as CSV (Admin only)' })
  async exportAll(
    @TenantId() tenant_id: string,
    @Query() query: EmployeeQueryDto,
    @Res() res: Response
  ) {
    const pageNumber = 1;
    const { items } = await this.service.findAll(tenant_id, query, pageNumber);
    const rows = (items || []).map((e: any) => ({
      id: e.id,
      user_id: e.user_id,
      first_name: e.user?.first_name,
      last_name: e.user?.last_name,
      email: e.user?.email,
      designation: e.designation?.title,
      department: e.designation?.department?.name,
      team: e.team?.name,
      status: e.status,
    }));
    return sendCsvResponse(res, 'employees.csv', rows);
  }

  @Get('joining-report')
  @Roles('admin', 'system-admin')
  @Permissions('view_reports', 'view_team_reports')
  @ApiOperation({ summary: 'Get employee joining report month-wise' })
  @ApiResponse({
    status: 200,
    description: 'Employee joining report retrieved successfully. Returns empty array if no employees found.',
    schema: {
      example: [
        {
          month: 1,
          year: 2025,
          total: 30,
        },
        {
          month: 2,
          year: 2025,
          total: 20,
        },
      ],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Empty array returned when no employees are found.',
    schema: {
      example: [],
    },
  })
  async getEmployeeJoiningReport(@TenantId() tenant_id: string) {
    return this.service.getEmployeeJoiningReport(tenant_id);
  }

  @Get('gender-percentage')
  @Roles('admin', 'system-admin')
  @Permissions('view_reports', 'view_team_reports')
  @ApiOperation({ summary: 'Get gender percentage of employees' })
  @ApiResponse({
    status: 200,
    description: 'Gender percentage retrieved successfully.',
    schema: {
      example: {
        male: 60, // Percentage of male employees
        female: 40, // Percentage of female employees
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No employees found for the tenant.',
    schema: {
      example: {
        message: 'No employees found for this tenant.',
        error: 'Not Found',
        statusCode: 404,
      },
    },
  })
  async getGenderPercentage(@TenantId() tenant_id: string) {
    return this.service.getGenderPercentage(tenant_id);
  }

  @Get('leaves-this-month')
  @Roles('admin', 'system-admin')
  @Permissions('view_reports', 'view_team_reports')
  @ApiOperation({ summary: 'Get total leaves applied by all employees for the current month' })
  @ApiResponse({ status: 200, description: 'Total leaves for the current month.' })
  async getLeavesThisMonth(@TenantId() tenant_id: string) {
    return this.leaveService.getTotalLeavesForCurrentMonth(tenant_id);
  }

  @Get('attendance-this-month')
  @Roles('admin', 'system-admin')
  @Permissions('view_reports', 'view_team_reports')
  @ApiOperation({
    summary:
      'Get total attendance for all employees for the current month (one per day per employee)',
  })
  @ApiResponse({ status: 200, description: 'Total attendance for the current month.' })
  async getAttendanceThisMonth(@TenantId() tenant_id: string) {
    return this.attendanceService.getTotalAttendanceForCurrentMonth(tenant_id);
  }

  @Get(':id')
  @Roles('admin', 'system-admin')
  @Permissions('manage_employees', 'view_team_reports')
  @ApiOperation({ summary: 'Get single employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee found.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async findOne(@TenantId() tenant_id: string, @Param('id') id: string) {
    return this.service.findOne(tenant_id, id);
  }

  @Delete(':id')
  @Roles('admin', 'system-admin')
  @Permissions('manage_employees')
  @ApiOperation({ summary: 'Delete employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee deleted.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async remove(@TenantId() tenant_id: string, @Param('id') id: string) {
    return this.service.remove(tenant_id, id);
  }

  @Post(':id/refresh-invite-status')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Resend invite if status is Invite Expired' })
  @ApiResponse({ status: 200, description: 'Invite resent successfully' })
  @ApiResponse({ status: 400, description: 'Invite can only be resent if status is Invite Expired' })
  @ApiResponse({ status: 404, description: 'Employee not found for this tenant' })
  async refreshInviteStatus(@TenantId() tenant_id: string, @Param('id') id: string) {
    return this.service.refreshInviteStatus(tenant_id, id);
  }

  @Get(':id/details')
  @Roles('admin', 'system-admin')
  @Permissions('manage_employees', 'view_team_reports')
  @ApiOperation({ summary: 'Get editable details for an employee' })
  @ApiResponse({ status: 200, description: 'Editable details returned.' })
  async getEditDetails(@TenantId() tenant_id: string, @Param('id') id: string) {
    const emp = await this.service.findOne(tenant_id, id);
    return {
      id: emp.id,
      first_name: emp.user.first_name,
      last_name: emp.user.last_name,
      email: emp.user.email,
      phone: emp.user.phone,
      designation_id: emp.designation_id,
      department_id: emp.designation?.department?.id ?? null,
    };
  }
}
