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
  UseInterceptors,
  UploadedFiles,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { EmployeeService } from '../services/employee.service';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto } from '../dto/employee.dto';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { TenantId } from '../../../common/decorators/company.deorator';
import { AttendanceService } from '../../attendance/attendance.service';
import { LeaveService } from '../../leave/leave.service';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Response } from 'express';
import { sendCsvResponse } from '../../../common/utils/csv.util';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { validateImageFile } from '../../../common/utils/file-validation.util';

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
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_picture', maxCount: 1 },
        { name: 'cnic_picture', maxCount: 1 },
        { name: 'cnic_back_picture', maxCount: 1 },
      ],
      {
        fileFilter: (_req, file, cb) => {
          try {
            // Skip validation if buffer is not available (empty optional file field)
            if (!file.buffer || file.buffer.length === 0) {
              // If buffer is empty, it might be an empty optional field, allow it
              // The validation will happen later when the file is actually used
              cb(null, true);
              return;
            }
            // Use comprehensive file validation with magic number checks
            validateImageFile(file);
            cb(null, true);
          } catch (error) {
            cb(error instanceof Error ? error : new Error('File validation failed'), false);
          }
        },
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new manager employee with optional profile and CNIC pictures' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        first_name: { type: 'string', example: 'John' },
        last_name: { type: 'string', example: 'Doe' },
        email: { type: 'string', example: 'john.doe@company.com' },
        phone: { type: 'string', example: '+1234567890' },
        designation_id: { type: 'string', example: 'uuid-string' },
        team_id: { type: 'string', example: 'uuid-string' },
        role_id: { type: 'string', example: 'uuid-string' },
        gender: { type: 'string', enum: ['male', 'female'] },
        password: { type: 'string', example: 'SecurePassword123!' },
        cnic_number: { type: 'string', example: '12345-1234567-1' },
        profile_picture: { type: 'string', format: 'binary' },
        cnic_picture: { type: 'string', format: 'binary' },
        cnic_back_picture: { type: 'string', format: 'binary' },
      },
      required: ['first_name', 'last_name', 'email', 'phone', 'designation_id'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Manager created successfully with manager role assigned (or custom role if provided)',
  })
  async createManager(
    @Req() req: any,
    @TenantId() tenant_id: string, 
    @Body() createEmployeeDto: CreateEmployeeDto,
    @UploadedFiles() files?: { 
      profile_picture?: Express.Multer.File[], 
      cnic_picture?: Express.Multer.File[], 
      cnic_back_picture?: Express.Multer.File[] 
    }
  ) {
    const createdByUserId = req.user?.id;
    return this.service.createManager(tenant_id, createdByUserId, createEmployeeDto, files);
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
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_picture', maxCount: 1 },
        { name: 'cnic_picture', maxCount: 1 },
        { name: 'cnic_back_picture', maxCount: 1 },
      ],
      {
        fileFilter: (_req, file, cb) => {
          try {
            // Skip validation if buffer is not available (empty optional file field)
            if (!file.buffer || file.buffer.length === 0) {
              // If buffer is empty, it might be an empty optional field, allow it
              // The validation will happen later when the file is actually used
              cb(null, true);
              return;
            }
            // Use comprehensive file validation with magic number checks
            validateImageFile(file);
            cb(null, true);
          } catch (error) {
            cb(error instanceof Error ? error : new Error('File validation failed'), false);
          }
        },
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create employee with optional profile and CNIC pictures' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        first_name: { type: 'string', example: 'John' },
        last_name: { type: 'string', example: 'Doe' },
        email: { type: 'string', example: 'john.doe@company.com' },
        phone: { type: 'string', example: '+1234567890' },
        designation_id: { type: 'string', example: 'uuid-string' },
        team_id: { type: 'string', example: 'uuid-string' },
        role_id: { type: 'string', example: 'uuid-string' },
        gender: { type: 'string', enum: ['male', 'female'] },
        password: { type: 'string', example: 'SecurePassword123!' },
        role_name: { type: 'string', example: 'employee' },
        cnic_number: { type: 'string', example: '12345-1234567-1' },
        profile_picture: { type: 'string', format: 'binary' },
        cnic_picture: { type: 'string', format: 'binary' },
        cnic_back_picture: { type: 'string', format: 'binary' },
      },
      required: ['first_name', 'last_name', 'email', 'phone', 'designation_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Employee created successfully.' })
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
  async create(
    @Req() req: any,
    @TenantId() tenant_id: string, 
    @Body() dto: CreateEmployeeDto,
    @UploadedFiles() files?: { 
      profile_picture?: Express.Multer.File[], 
      cnic_picture?: Express.Multer.File[], 
      cnic_back_picture?: Express.Multer.File[] 
    }
  ) {
    const createdByUserId = req.user?.id;
    return this.service.create(tenant_id, createdByUserId, dto, files);
  }

  @Put(':id')
  @Roles('admin', 'system-admin')
  @Permissions('manage_employees')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_picture', maxCount: 1 },
        { name: 'cnic_picture', maxCount: 1 },
        { name: 'cnic_back_picture', maxCount: 1 },
      ],
      {
        fileFilter: (_req, file, cb) => {
          try {
            // Skip validation if buffer is not available (empty optional file field)
            if (!file.buffer || file.buffer.length === 0) {
              // If buffer is empty, it might be an empty optional field, allow it
              // The validation will happen later when the file is actually used
              cb(null, true);
              return;
            }
            // Use comprehensive file validation with magic number checks
            validateImageFile(file);
            cb(null, true);
          } catch (error) {
            cb(error instanceof Error ? error : new Error('File validation failed'), false);
          }
        },
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update employee details including designation, role, and pictures (profile, CNIC front/back)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        first_name: { type: 'string', example: 'John' },
        last_name: { type: 'string', example: 'Doe' },
        email: { type: 'string', example: 'john.doe@company.com' },
        phone: { type: 'string', example: '+1234567890' },
        password: { type: 'string', example: 'SecurePassword123!' },
        designation_id: { type: 'string', example: 'uuid-string' },
        team_id: { type: 'string', example: 'uuid-string' },
        role_id: { type: 'string', example: 'uuid-string' },
        role_name: { type: 'string', example: 'employee' },
        gender: { type: 'string', enum: ['male', 'female', 'other'] },
        cnic_number: { type: 'string', example: '12345-1234567-1' },
        profile_picture: { type: 'string', format: 'binary' },
        cnic_picture: { type: 'string', format: 'binary' },
        cnic_back_picture: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Employee updated successfully.' })
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
    @Body() dto: UpdateEmployeeDto,
    @UploadedFiles() files?: { 
      profile_picture?: Express.Multer.File[], 
      cnic_picture?: Express.Multer.File[], 
      cnic_back_picture?: Express.Multer.File[] 
    }
  ) {
    return this.service.update(tenant_id, id, dto, files);
  }

  @Get()
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('manage_employees')
  @ApiOperation({
    summary: 'List all employees for tenant with optional designation, department filters, and search',
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
    name: 'search',
    required: false,
    description: 'Search term to filter employees by name, email, phone, CNIC, designation, department, or team',
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
    const pageNumber = Math.max(1, parseInt(query.page?.toString() || '1', 10) || 1);
    return this.service.findAll(tenant_id, query, pageNumber);
  }


  @Get('export')
  @Roles('admin', 'system-admin' ,'hr-admin')
  @ApiOperation({ summary: 'Download employees list as CSV (Admin only)' })
  async exportAll(
    @TenantId() tenant_id: string,
    @Query() query: EmployeeQueryDto,
    @Res() res: Response
  ) {
    // Fetch all pages of employees so CSV includes complete dataset (no pagination)
    let pageNumber = 1;
    const allItems: any[] = [];

    while (true) {
      const { items, total, limit } = await this.service.findAll(tenant_id, query, pageNumber);
      allItems.push(...(items || []));

      if (!items.length || allItems.length >= total) {
        break;
      }

      pageNumber += 1;

      // Safety: if last page returned fewer than limit, we are done
      if (limit && items.length < limit) {
        break;
      }
    }

    const rows = (allItems || []).map((e: any) => ({
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

  @Get('system/export')
  @Roles('system-admin')
  @Permissions('manage_employees')
  @ApiOperation({ summary: 'Download employees for all tenants as CSV (System-admin only)' })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    description: 'Optional tenant ID to filter employees for a specific tenant',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  async exportForSystemAdmin(
    @Query('tenantId') tenantId: string | undefined,
    @Res() res: Response,
  ) {
    const items = await this.service.getAllEmployeesForSystemAdmin(tenantId);

    const rows = (items || []).map((e: any) => ({
      tenant_id: e.user?.tenant?.id,
      tenant_name: e.user?.tenant?.name,
      tenant_status: e.user?.tenant?.status,
      employee_id: e.id,
      user_id: e.user_id,
      first_name: e.user?.first_name,
      last_name: e.user?.last_name,
      email: e.user?.email,
      phone: e.user?.phone,
      designation: e.designation?.title,
      department: e.designation?.department?.name,
      team: e.team?.name,
      status: e.status,
      invite_status: e.invite_status,
      created_at: e.created_at,
    }));

    const filename = tenantId
      ? `employees-tenant-${tenantId}.csv`
      : 'employees-all-tenants.csv';
    return sendCsvResponse(res, filename, rows);
  }

  @Get('joining-report')
  @Roles('admin', 'system-admin', 'hr-admin')
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
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('view_reports', 'view_team_reports')
  @ApiOperation({ summary: 'Get gender percentage of employees' })
  @ApiResponse({
    status: 200,
    description: 'Gender percentage retrieved successfully.',
    schema: {
      example: {
        male: 60, 
        female: 40, 
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
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('view_reports', 'view_team_reports')
  @ApiOperation({ summary: 'Get total leaves applied by all employees for the current month' })
  @ApiResponse({ status: 200, description: 'Total leaves for the current month.' })
  async getLeavesThisMonth(@TenantId() tenant_id: string) {
    return this.leaveService.getTotalLeavesForCurrentMonth(tenant_id);
  }

  @Get('attendance-this-month')
  @Roles('admin', 'system-admin', 'hr-admin')
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
  @Roles('admin', 'system-admin', 'hr-admin', 'manager')
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
  @Roles('admin', 'system-admin', 'hr-admin')
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
