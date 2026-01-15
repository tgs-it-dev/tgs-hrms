import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReimbursementService } from './reimbursement.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TenantId } from '../../../common/decorators/company.deorator';
import { JwtUserPayloadDto } from '../../auth/dto/jwt-payload.dto';
import { CreateReimbursementRequestDto } from '../dto/reimbursement/create-reimbursement-request.dto';
import { UpdateReimbursementRequestDto } from '../dto/reimbursement/update-reimbursement-request.dto';
import { ReviewReimbursementRequestDto } from '../dto/reimbursement/review-reimbursement-request.dto';
import { validateImageFile } from '../../../common/utils/file-validation.util';

@ApiTags('Benefit Reimbursement')
@Controller('benefit-reimbursements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReimbursementController {
  constructor(private readonly reimbursementService: ReimbursementService) {}

  @Post()
  @Roles('employee', 'hr-admin', 'admin')
  @ApiOperation({
    summary: 'Create a reimbursement request for a benefit',
    description:
      'Employees can request reimbursement for benefits they paid personally',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        employeeBenefitId: {
          type: 'string',
          format: 'uuid',
          description: 'Employee Benefit ID (the benefit assignment)',
        },
        amount: {
          type: 'number',
          description: 'Reimbursement amount',
        },
        details: {
          type: 'string',
          description: 'Details about the reimbursement request',
        },
        proofDocuments: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Proof documents (images)',
        },
      },
      required: ['employeeBenefitId', 'amount', 'details'],
    },
  })
  @UseInterceptors(
    FilesInterceptor('proofDocuments', 10, {
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
              : new BadRequestException(
                  'File validation failed. Please upload a valid image file',
                ),
            false,
          );
        }
      },
    }),
  )
  async create(
    @TenantId() tenant_id: string,
    @Req() req: any,
    @Body() dto: CreateReimbursementRequestDto,
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

    const user = (req as { user: JwtUserPayloadDto }).user;

    return this.reimbursementService.create(tenant_id, user.id, dto, files);
  }

  @Get()
  @Roles('employee', 'hr-admin', 'admin', 'manager')
  @ApiOperation({
    summary: 'Get reimbursement requests',
    description:
      'Employees see their own requests. HR/Admin see all requests for their tenant',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    type: Number,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    description: 'Filter by employee ID (HR/Admin only)',
    type: String,
  })
  async findAll(
    @TenantId() tenant_id: string,
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const user = (req as { user: JwtUserPayloadDto }).user;
    const userRole = user.role;
    const isEmployee = userRole === 'employee';

    // Employees can only see their own requests
    if (isEmployee) {
      // Get employee ID from user ID
      const employee = await this.reimbursementService.getEmployeeByUserId(
        tenant_id,
        user.id,
      );
      if (!employee) {
        throw new BadRequestException('Employee not found');
      }
      return await this.reimbursementService.findAllByEmployee(
        tenant_id,
        employee.id,
        parseInt(page, 10) || 1,
      );
    }

    // HR/Admin can see all requests
    return await this.reimbursementService.findAll(
      tenant_id,
      parseInt(page, 10) || 1,
      status as any,
      employeeId,
    );
  }

  @Get(':id')
  @Roles('employee', 'hr-admin', 'admin', 'manager')
  @ApiOperation({
    summary: 'Get a specific reimbursement request',
  })
  async findOne(
    @TenantId() tenant_id: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const user = (req as { user: JwtUserPayloadDto }).user;
    const userRole = user.role;
    const isEmployee = userRole === 'employee';

    // Employees can only see their own requests
    if (isEmployee) {
      const employee = await this.reimbursementService.getEmployeeByUserId(
        tenant_id,
        user.id,
      );
      if (!employee) {
        throw new BadRequestException('Employee not found');
      }
      return this.reimbursementService.findOne(tenant_id, id, employee.id);
    }

    // HR/Admin can see any request
    return this.reimbursementService.findOne(tenant_id, id);
  }

  @Put(':id')
  @Roles('employee', 'hr-admin', 'admin')
  @ApiOperation({
    summary: 'Update a reimbursement request',
    description: 'Only pending requests can be updated by the employee',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Updated reimbursement amount',
        },
        details: {
          type: 'string',
          description: 'Updated details',
        },
        proofDocuments: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Additional proof documents',
        },
        documentsToRemove: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Document paths to remove',
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('proofDocuments', 10, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        try {
          if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            return cb(
              new BadRequestException(
                'Only image files are allowed (JPG, JPEG, PNG, GIF, WebP)',
              ),
              false,
            );
          }
          cb(null, true);
        } catch (error) {
          cb(
            error instanceof BadRequestException
              ? error
              : new BadRequestException('File validation failed'),
            false,
          );
        }
      },
    }),
  )
  async update(
    @TenantId() tenant_id: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateReimbursementRequestDto & { documentsToRemove?: string[] },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const user = (req as { user: JwtUserPayloadDto }).user;
    const employee = await this.reimbursementService.getEmployeeByUserId(
      tenant_id,
      user.id,
    );
    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

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

    return this.reimbursementService.update(
      tenant_id,
      id,
      employee.id,
      dto,
      files,
      dto.documentsToRemove,
    );
  }

  @Delete(':id/cancel')
  @Roles('employee', 'hr-admin', 'admin')
  @ApiOperation({
    summary: 'Cancel a reimbursement request',
    description: 'Only pending requests can be cancelled by the employee',
  })
  async cancel(
    @TenantId() tenant_id: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const user = (req as { user: JwtUserPayloadDto }).user;
    const employee = await this.reimbursementService.getEmployeeByUserId(
      tenant_id,
      user.id,
    );
    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    return this.reimbursementService.cancel(tenant_id, id, employee.id);
  }

  @Put(':id/review')
  @Roles('hr-admin', 'admin')
  @ApiOperation({
    summary: 'Review (approve/reject) a reimbursement request',
    description: 'HR/Admin can approve or reject reimbursement requests',
  })
  async review(
    @TenantId() tenant_id: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: ReviewReimbursementRequestDto,
  ) {
    const user = (req as { user: JwtUserPayloadDto }).user;
    const employee = await this.reimbursementService.getEmployeeByUserId(
      tenant_id,
      user.id,
    );
    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    return this.reimbursementService.review(tenant_id, id, employee.id, dto);
  }
}
