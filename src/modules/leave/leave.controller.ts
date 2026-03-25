import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { CreateLeaveForEmployeeDto } from './dto/create-leave-for-employee.dto';
import { ApproveLeaveDto, RejectLeaveDto, ManagerRemarksDto, EditLeaveDto, RemoveLeaveDocumentDto } from './dto/update-leave.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Response } from 'express';
import { sendCsvResponse } from 'src/common/utils/csv.util';
import { FilesInterceptor } from '@nestjs/platform-express';
import { validateImageFile } from 'src/common/utils/file-validation.util';

@ApiTags('Leaves')
@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) { }

  @Post()
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit a new leave request' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        leaveTypeId: {
          type: 'string',
          format: 'uuid',
          description: 'Leave type ID',
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Start date of leave',
        },
        endDate: {
          type: 'string',
          format: 'date',
          description: 'End date of leave',
        },
        reason: {
          type: 'string',
          description: 'Reason for leave',
        },
        documents: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Optional image documents (max 5MB each)',
        },
      },
      required: ['leaveTypeId', 'startDate', 'endDate', 'reason'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Leave request created successfully',
  })
  @UseInterceptors(
    FilesInterceptor('documents', 10, {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
      fileFilter: (_req, file, cb) => {
        try {
          // Check MIME type first
          if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            return cb(
              new BadRequestException(
                `Invalid file type: ${file.mimetype || 'unknown'}. Only image files are allowed (JPG, JPEG, PNG, GIF, WebP)`,
              ),
              false,
            );
          }

          // Check file extension
          const fileExtension = file.originalname
            .substring(file.originalname.lastIndexOf('.'))
            .toLowerCase();
          const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

          if (!allowedExtensions.includes(fileExtension)) {
            return cb(
              new BadRequestException(
                `Invalid file extension: ${fileExtension}. Allowed extensions: ${allowedExtensions.join(', ')}`,
              ),
              false,
            );
          }

          cb(null, true);
        } catch (error) {
          cb(
            error instanceof BadRequestException
              ? error
              : new BadRequestException('File validation failed. Please upload a valid image file'),
            false,
          );
        }
      },
    }),
  )
  async create(
    @Body() dto: CreateLeaveDto,
    @Request() req: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // Validate files if provided
    if (files && files.length > 0) {
      try {
        files.forEach((file) => {
          validateImageFile(file);
        });
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          error instanceof Error ? error.message : 'File validation failed',
        );
      }
    }
    return this.leaveService.createLeave(req.user.id, req.user.tenant_id, dto, files);
  }

  @Post('for-employee')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'hr-admin', 'system-admin')
  @Permissions('manage_leaves')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Apply for leave on behalf of an employee (Admin/HR Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        employeeId: {
          type: 'string',
          format: 'uuid',
          description: 'Employee ID (User ID) for whom leave is being applied',
        },
        leaveTypeId: {
          type: 'string',
          format: 'uuid',
          description: 'Leave type ID',
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Start date of leave',
        },
        endDate: {
          type: 'string',
          format: 'date',
          description: 'End date of leave',
        },
        reason: {
          type: 'string',
          description: 'Reason for leave',
        },
        documents: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Optional image documents (max 5MB each)',
        },
      },
      required: ['employeeId', 'leaveTypeId', 'startDate', 'endDate', 'reason'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Leave request created successfully for employee',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/HR Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found or does not belong to tenant',
  })
  @UseInterceptors(
    FilesInterceptor('documents', 10, {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
      fileFilter: (_req, file, cb) => {
        try {
          // Check MIME type first
          if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            return cb(
              new BadRequestException(
                `Invalid file type: ${file.mimetype || 'unknown'}. Only image files are allowed (JPG, JPEG, PNG, GIF, WebP)`,
              ),
              false,
            );
          }

          // Check file extension
          const fileExtension = file.originalname
            .substring(file.originalname.lastIndexOf('.'))
            .toLowerCase();
          const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

          if (!allowedExtensions.includes(fileExtension)) {
            return cb(
              new BadRequestException(
                `Invalid file extension: ${fileExtension}. Allowed extensions: ${allowedExtensions.join(', ')}`,
              ),
              false,
            );
          }

          cb(null, true);
        } catch (error) {
          cb(
            error instanceof BadRequestException
              ? error
              : new BadRequestException('File validation failed. Please upload a valid image file'),
            false,
          );
        }
      },
    }),
  )
  async createLeaveForEmployee(
    @Body() dto: CreateLeaveForEmployeeDto,
    @Request() req: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // Validate files if provided
    if (files && files.length > 0) {
      try {
        files.forEach((file) => {
          validateImageFile(file);
        });
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          error instanceof Error ? error.message : 'File validation failed',
        );
      }
    }
    return this.leaveService.createLeaveForEmployee(
      req.user.id,
      req.user.tenant_id,
      dto,
      files,
    );
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
        limit: 25,
        totalPages: 1,
      },
    },
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 25, max: 100)', type: Number })
  @ApiQuery({ name: 'name', required: false, description: 'Filter by team member name (partial match on first/last name)', type: String })
  async getTeamLeaves(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('name') name?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 25)) : undefined;

    if (req.user.role !== 'manager') {
      throw new ForbiddenException('Access denied. Manager role required.');
    }

    return this.leaveService.getTeamLeaves(req.user.id, req.user.tenant_id, pageNumber, {
      name: name?.trim() || undefined,
      limit: limitNumber,
    });
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

    if (req.user.role !== 'manager') {
      throw new ForbiddenException('Access denied. Manager role required.');
    }

    return this.leaveService.getTeamMembersWithLeaveApplications(req.user.id, req.user.tenant_id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all leaves for logged-in employee' })
  @ApiResponse({ status: 200, description: 'Returns leave requests' })
  async find(@Request() req: any, @Query('page') page?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.leaveService.getLeaves(req.user.id, pageNumber, req.user.tenant_id);
  }

  @Get('all')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin', 'hr-admin', 'network-admin')
  @Permissions('manage_leaves', 'view_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all leave requests (Admin/HR Admin/Network Admin only)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination (default: 1)', type: String })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by leave status', type: String })
  @ApiQuery({ name: 'month', required: false, description: 'Filter by month (1-12)', type: Number })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year (defaults to current year if month is provided)', type: Number })
  @ApiQuery({ name: 'name', required: false, description: 'Filter by employee name (partial match on first/last name)', type: String })
  @ApiResponse({ status: 200, description: 'Returns all leave requests' })
  async findAllForAdmin(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('status') status?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('name') name?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const monthNumber = month ? parseInt(month, 10) : undefined;
    const yearNumber = year ? parseInt(year, 10) : undefined;
    return this.leaveService.getAllLeaves(req.user.tenant_id, pageNumber, status, monthNumber, yearNumber, name);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get specific leave details' })
  @ApiResponse({ status: 200, description: 'Returns leave details' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.leaveService.getLeaveById(id, req.user.id, req.user.tenant_id);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('approve_leaves', 'manage_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a leave request (Admin or System Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Leave request approved successfully',
  })
  async approveLeave(@Param('id') id: string, @Body() dto: ApproveLeaveDto, @Request() req: any) {
    return this.leaveService.approveLeave(id, req.user.id, req.user.tenant_id, dto.remarks);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('approve_leaves', 'manage_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a leave request (Admin or System Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Leave request rejected successfully',
  })
  async rejectLeave(@Param('id') id: string, @Body() dto: RejectLeaveDto, @Request() req: any) {
    return this.leaveService.rejectLeave(id, req.user.id, req.user.tenant_id, dto.remarks);
  }

  // PUT aliases for approve/reject to match external API spec
  @Put(':id/approve')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('approve_leaves', 'manage_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a leave request (Admin or System Admin only) [PUT alias]' })
  @ApiResponse({ status: 200, description: 'Leave request approved successfully' })
  async approveLeavePut(@Param('id') id: string, @Body() dto: ApproveLeaveDto, @Request() req: any) {
    return this.leaveService.approveLeave(id, req.user.id, req.user.tenant_id, dto.remarks);
  }

  @Put(':id/reject')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('approve_leaves', 'manage_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a leave request (Admin or System Admin only) [PUT alias]' })
  @ApiResponse({ status: 200, description: 'Leave request rejected successfully' })
  async rejectLeavePut(@Param('id') id: string, @Request() req: any) {
    return this.leaveService.rejectLeave(id, req.user.id, req.user.tenant_id);
  }

  @Patch(':id/manager-remarks')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('manage_team_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add or update manager remarks on a team member\'s leave (Manager only)' })
  @ApiResponse({
    status: 200,
    description: 'Manager remarks updated successfully',
  })
  async addManagerRemarks(
    @Param('id') id: string,
    @Body() dto: ManagerRemarksDto,
    @Request() req: any,
  ) {
    return this.leaveService.addManagerRemarks(id, req.user.id, req.user.tenant_id, dto.remarks);
  }

  @Patch(':id/approve-manager')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('approve_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a leave request (Manager - Optional)' })
  @ApiResponse({
    status: 200,
    description: 'Leave request approved successfully by manager',
  })
  async approveLeaveByManager(@Param('id') id: string, @Body() dto: ApproveLeaveDto, @Request() req: any) {
    return this.leaveService.approveLeave(id, req.user.id, req.user.tenant_id, dto.remarks);
  }

  @Patch(':id/reject-manager')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager')
  @Permissions('approve_leaves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a leave request with remarks (Manager - Optional)' })
  @ApiResponse({
    status: 200,
    description: 'Leave request rejected successfully by manager',
  })
  async rejectLeaveByManager(@Param('id') id: string, @Body() dto: RejectLeaveDto, @Request() req: any) {
    return this.leaveService.rejectLeave(id, req.user.id, req.user.tenant_id, dto.remarks);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel a pending leave request (Employee can cancel own, Admin/HR Admin can cancel any)',
  })
  @ApiResponse({
    status: 200,
    description: 'Leave request cancelled successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only cancel own pending leave requests (or Admin/HR Admin can cancel any)',
  })
  @ApiResponse({
    status: 404,
    description: 'Leave request not found',
  })
  async cancelLeave(@Param('id') id: string, @Request() req: any) {
    return this.leaveService.cancelLeave(id, req.user.id, req.user.tenant_id, req.user.role);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow documents field which is handled separately via @UploadedFiles
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      },
      skipMissingProperties: true, // Skip validation for missing/undefined properties
      skipNullProperties: true, // Skip validation for null properties
      skipUndefinedProperties: true, // Skip validation for undefined properties
      validateCustomDecorators: true,
      exceptionFactory: (errors) => {
        // Filter out 'documents' field errors since it's handled separately via @UploadedFiles
        const filteredErrors = errors.filter(
          (error) => error.property !== 'documents',
        );
        if (filteredErrors.length === 0) {
          return new BadRequestException('Validation failed');
        }
        const errorMessages = filteredErrors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
        }));
        return new BadRequestException({
          message: 'Validation Error',
          errors: errorMessages,
        });
      },
    }),
  )
  @ApiOperation({ summary: 'Edit a leave request (Employee can edit own, Admin/HR Admin can edit any)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        leaveTypeId: {
          type: 'string',
          format: 'uuid',
          description: 'Leave type ID',
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Start date of leave',
        },
        endDate: {
          type: 'string',
          format: 'date',
          description: 'End date of leave',
        },
        reason: {
          type: 'string',
          description: 'Reason for leave',
        },
        documents: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Optional image documents (max 5MB each). If leave is approved, only documents can be updated.',
        },
      },
      // All fields are optional - no required fields
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Leave request updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot edit approved leave fields (only documents allowed) OR not authorized to edit this leave',
  })
  @ApiResponse({
    status: 404,
    description: 'Leave request not found',
  })
  @UseInterceptors(
    FilesInterceptor('documents', 10, {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
      fileFilter: (_req, file, cb) => {
        try {
          // Check MIME type first
          if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            return cb(
              new BadRequestException(
                `Invalid file type: ${file.mimetype || 'unknown'}. Only image files are allowed (JPG, JPEG, PNG, GIF, WebP)`,
              ),
              false,
            );
          }

          // Check file extension
          const fileExtension = file.originalname
            .substring(file.originalname.lastIndexOf('.'))
            .toLowerCase();
          const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

          if (!allowedExtensions.includes(fileExtension)) {
            return cb(
              new BadRequestException(
                `Invalid file extension: ${fileExtension}. Allowed extensions: ${allowedExtensions.join(', ')}`,
              ),
              false,
            );
          }

          cb(null, true);
        } catch (error) {
          cb(
            error instanceof BadRequestException
              ? error
              : new BadRequestException('File validation failed. Please upload a valid image file'),
            false,
          );
        }
      },
    }),
  )
  async editLeave(
    @Param('id') id: string,
    @Body() dto: EditLeaveDto,
    @Request() req: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // Validate files if provided
    if (files && files.length > 0) {
      try {
        files.forEach((file) => {
          validateImageFile(file);
        });
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          error instanceof Error ? error.message : 'File validation failed',
        );
      }
    }

    // Debug: Log the DTO to verify values are being received
    // console.log('EditLeave DTO received:', JSON.stringify(dto, null, 2));

    return this.leaveService.editLeave(id, req.user.id, req.user.tenant_id, dto, files, req.user.role);
  }

  @Delete(':id/documents')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove one document from leave (e.g. click on image to delete)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['documentUrl'],
      properties: {
        documentUrl: {
          type: 'string',
          example: '/leave-documents/8afaf744-278d-4905-aecd-79bff53941f0-1769611361810.png',
          description: 'URL of the document to remove',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Document removed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Leave or document not found' })
  async removeLeaveDocument(
    @Param('id') id: string,
    @Body() dto: RemoveLeaveDocumentDto,
    @Request() req: any,
  ) {
    return this.leaveService.removeLeaveDocument(
      id,
      dto.documentUrl,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
    );
  }


  @Get('export/self')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download your leave requests as CSV' })
  async exportSelf(@Request() req: any, @Res() res: Response) {
    let page = 1;
    const rows: any[] = [];
    while (true) {
      const { items, total, limit } = await this.leaveService.getLeaves(req.user.id, page);
      for (const l of items) {
        const empFirstName = l.employee?.first_name || req.user.first_name || '';
        const empLastName = l.employee?.last_name || req.user.last_name || '';
        rows.push({
          first_name: empFirstName,
          last_name: empLastName,
          user_name: `${empFirstName} ${empLastName}`.trim(),
          leave_type: l.leaveType?.name || 'N/A',
          start_date: l.startDate,
          end_date: l.endDate,
          total_days: l.totalDays,
          status: l.status,
          reason: l.reason,
          applied_date: l.createdAt,
          approved_by: l.approver?.first_name ? `${l.approver.first_name} ${l.approver.last_name}`.trim() : 'N/A',
          approved_at: l.approvedAt || 'N/A',
          remarks: l.remarks || 'N/A',
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
  @ApiQuery({ name: 'name', required: false, description: 'Filter by team member name (partial match)', type: String })
  async exportTeam(
    @Request() req: any,
    @Res() res: Response,
    @Query('page') _page?: string,
    @Query('name') name?: string,
  ) {
    // Fetch all pages of team leaves so CSV includes complete dataset (no pagination)
    let currentPage = 1;
    const rows: any[] = [];
    const options = { name: name?.trim() || undefined, limit: 25 };

    while (true) {
      const { items, total, limit } = await this.leaveService.getTeamLeaves(
        req.user.id,
        req.user.tenant_id,
        currentPage,
        options,
      );

      for (const l of items || []) {
        rows.push({
          id: l.id,
          user_id: l.employeeId,
          first_name: l.employee?.first_name || '',
          last_name: l.employee?.last_name || '',
          user_name: `${l.employee?.first_name || ''} ${l.employee?.last_name || ''}`.trim(),
          leave_type: l.leaveType?.name || 'N/A',
          start_date: l.startDate,
          end_date: l.endDate,
          total_days: l.totalDays,
          status: l.status,
          reason: l.reason,
          applied_date: l.createdAt,
          approved_by: l.approver?.first_name
            ? `${l.approver.first_name} ${l.approver.last_name}`.trim()
            : 'N/A',
          approved_at: l.approvedAt || 'N/A',
          remarks: l.remarks || 'N/A',
        });
      }

      if (!items.length || rows.length >= total) {
        break;
      }

      currentPage += 1;

      // Safety: if last page returned fewer than limit, we are done
      if (limit && items.length < limit) {
        break;
      }
    }

    return sendCsvResponse(res, 'leaves-team.csv', rows);
  }

  @Get('export/all')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin', 'hr-admin', 'network-admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download all leave requests for tenant as CSV (Admin/HR Admin/Network Admin only)' })
  @ApiQuery({ name: 'month', required: false, description: 'Filter by month (1-12)', type: Number })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year (defaults to current year if month is provided)', type: Number })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by leave status', type: String })
  @ApiQuery({ name: 'name', required: false, description: 'Filter by employee name (partial match)', type: String })
  async exportAll(
    @Request() req: any,
    @Res() res: Response,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('status') status?: string,
    @Query('name') name?: string,
  ) {
    let page = 1;
    const rows: any[] = [];
    const monthNumber = month ? parseInt(month, 10) : undefined;
    const yearNumber = year ? parseInt(year, 10) : undefined;
    while (true) {
      const { items, total, limit } = await this.leaveService.getAllLeaves(
        req.user.tenant_id,
        page,
        status,
        monthNumber,
        yearNumber,
        name,
      );
      for (const l of items) {
        rows.push({
          first_name: l.employee?.first_name || '',
          last_name: l.employee?.last_name || '',
          user_name: `${l.employee?.first_name || ''} ${l.employee?.last_name || ''}`.trim(),
          leave_type: l.leaveType?.name || 'N/A',
          start_date: l.startDate,
          end_date: l.endDate,
          total_days: l.totalDays,
          status: l.status,
          reason: l.reason,
          applied_date: l.createdAt,
          approved_by: l.approver?.first_name ? `${l.approver.first_name} ${l.approver.last_name}`.trim() : 'N/A',
          approved_at: l.approvedAt || 'N/A',
          remarks: l.remarks || 'N/A',
        });
      }
      if (!items.length || rows.length >= total) break;
      page += 1;
      if (limit && items.length < limit) break;
    }
    return sendCsvResponse(res, 'leaves-all.csv', rows);
  }
}
