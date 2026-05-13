import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiParam,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';

import { OvertimeService } from './overtime.service';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { UpdateOvertimeDto } from './dto/update-overtime.dto';
import { RemoveAttachmentDto } from '../../common/dto/remove-attachment.dto';
import { OvertimeStatus } from '../../common/constants/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../common/types/request.types';
import { createImageFileFilter } from '../../common/utils/file-validation.util';

const OVERTIME_EXAMPLE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  employee_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  tenant_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  start_date: '2026-05-10',
  end_date: '2026-05-10',
  hours: 4,
  reason: 'Critical deployment requiring after-hours work',
  status: 'pending',
  attachments: [],
  workflow_request_id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
  created_at: '2026-05-09T08:00:00.000Z',
  updated_at: '2026-05-09T08:00:00.000Z',
};

const PAGINATED_OVERTIME_EXAMPLE = {
  items: [OVERTIME_EXAMPLE],
  total: 1,
  page: 1,
  limit: 20,
};

@ApiTags('Overtime')
@ApiBearerAuth()
@Controller('overtime')
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit an overtime request',
    description: `Two mutually exclusive modes:
- **Hours mode** — provide \`start_date\` + \`hours\`. The date must be a Saturday or Sunday.
- **Range mode** — provide \`start_date\` + \`end_date\`. Every day in the range must be Saturday or Sunday. Hours are auto-calculated (8 h per day).

Providing both \`hours\` and \`end_date\`, or neither, will return a 400 error.`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['start_date', 'reason'],
      properties: {
        start_date: {
          type: 'string',
          format: 'date',
          example: '2026-05-10',
          description: 'Overtime date — must be Saturday or Sunday (ISO 8601)',
        },
        end_date: {
          type: 'string',
          format: 'date',
          example: '2026-05-11',
          description:
            'Range mode only — last date of the range. Every day must be Saturday or Sunday. Omit when providing hours.',
        },
        hours: {
          type: 'number',
          minimum: 0.5,
          maximum: 24,
          example: 4,
          description:
            'Hours mode only — overtime hours for start_date. Omit when providing end_date.',
        },
        reason: {
          type: 'string',
          minLength: 5,
          maxLength: 500,
          example: 'Critical deployment requiring after-hours work',
        },
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Optional supporting images (max 5 MB each, up to 10)',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Overtime request created and workflow initiated',
    schema: { example: OVERTIME_EXAMPLE },
  })
  @ApiBadRequestResponse({
    description:
      'Validation error — e.g. both hours and end_date provided, weekday in range, workflow disabled',
  })
  @ApiForbiddenResponse({
    description: 'An overlapping pending or approved request already exists',
  })
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: createImageFileFilter(),
    }),
  )
  async create(
    @Body() dto: CreateOvertimeDto,
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.overtimeService.createOvertimeRequest(
      req.user.id,
      req.user.tenant_id,
      dto,
      files,
    );
  }

  // must be before /:id so NestJS does not match 'me' as a UUID param
  @Get('me')
  @ApiOperation({
    summary: 'List overtime requests submitted by the current user',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({
    description: 'Paginated list of overtime requests for the logged-in user',
    schema: { example: PAGINATED_OVERTIME_EXAMPLE },
  })
  async getMyRequests(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.overtimeService.getMyOvertimeRequests(
      req.user.id,
      req.user.tenant_id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get()
  @Roles('admin', 'hr-admin', 'system-admin', 'network-admin', 'manager')
  @ApiOperation({
    summary: 'List all overtime requests across the tenant (admin/manager)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', enum: OvertimeStatus, required: false })
  @ApiOkResponse({
    description: 'Paginated list of all overtime requests with employee info',
    schema: { example: PAGINATED_OVERTIME_EXAMPLE },
  })
  async getAllRequests(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OvertimeStatus,
  ) {
    return this.overtimeService.getAllOvertimeRequests(
      req.user.tenant_id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single overtime request by ID' })
  @ApiParam({ name: 'id', description: 'Overtime request UUID' })
  @ApiOkResponse({
    description:
      'Overtime request detail with workflow status and approver names',
    schema: {
      example: {
        ...OVERTIME_EXAMPLE,
        workflow: {
          id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
          status: 'approved',
          request_type: 'overtime',
          current_step_order: 1,
          total_steps: 1,
          requestor: {
            id: OVERTIME_EXAMPLE.employee_id,
            first_name: 'Ali',
            last_name: 'Hassan',
          },
          steps: [
            {
              id: 'step-uuid-1',
              step_order: 1,
              step_label: 'Manager Approval',
              approver_role: 'manager',
              status: 'approved',
              approver_id: 'mgr-uuid',
              approver: {
                id: 'mgr-uuid',
                first_name: 'Sara',
                last_name: 'Khan',
              },
              remarks: 'Approved',
              acted_at: '2026-05-10T09:00:00.000Z',
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Overtime request not found' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.overtimeService.getOvertimeById(id, req.user.tenant_id);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Edit a pending overtime request',
    description: `All fields are optional. Mode rules still apply:
- Provide \`hours\` (no \`end_date\`) → hours mode — start_date must be Saturday or Sunday.
- Provide \`end_date\` (no \`hours\`) → range mode — all days must be Saturday or Sunday, hours auto-recalculated.
- Provide neither → only reason/attachments updated, dates unchanged.`,
  })
  @ApiParam({ name: 'id', description: 'Overtime request UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          format: 'date',
          example: '2026-05-10',
          description: 'New start date — must be Saturday or Sunday',
        },
        end_date: {
          type: 'string',
          format: 'date',
          example: '2026-05-11',
          description: 'Range mode only — new end date',
        },
        hours: {
          type: 'number',
          minimum: 0.5,
          maximum: 24,
          example: 4,
          description: 'Hours mode only — updated overtime hours',
        },
        reason: { type: 'string', minLength: 5, maxLength: 500 },
        attachments_to_remove: {
          type: 'array',
          items: { type: 'string' },
          description: 'URLs of existing attachments to delete',
        },
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'New files to add (max 5 MB each, up to 10)',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Updated overtime request',
    schema: { example: OVERTIME_EXAMPLE },
  })
  @ApiNotFoundResponse({ description: 'Overtime request not found' })
  @ApiForbiddenResponse({
    description: 'Not your request, or request is not in pending status',
  })
  @ApiBadRequestResponse({
    description:
      'Validation error — e.g. both hours and end_date provided, weekday in range',
  })
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: createImageFileFilter(),
    }),
  )
  async edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOvertimeDto,
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.overtimeService.editOvertimeRequest(
      id,
      req.user.id,
      req.user.tenant_id,
      dto,
      files,
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending overtime request' })
  @ApiParam({ name: 'id', description: 'Overtime request UUID' })
  @ApiOkResponse({
    description: 'Overtime request cancelled',
    schema: { example: { ...OVERTIME_EXAMPLE, status: 'cancelled' } },
  })
  @ApiNotFoundResponse({ description: 'Overtime request not found' })
  @ApiForbiddenResponse({
    description: 'Not your request, or request is not in pending status',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.overtimeService.cancelOvertimeRequest(
      id,
      req.user.id,
      req.user.tenant_id,
    );
  }

  @Delete(':id/attachments')
  @ApiOperation({
    summary: 'Remove an attachment from a pending overtime request',
  })
  @ApiParam({ name: 'id', description: 'Overtime request UUID' })
  @ApiBody({ type: RemoveAttachmentDto })
  @ApiOkResponse({
    description: 'Updated overtime request with the attachment removed',
    schema: { example: OVERTIME_EXAMPLE },
  })
  @ApiNotFoundResponse({ description: 'Overtime request not found' })
  @ApiBadRequestResponse({ description: 'URL not found on this request' })
  @ApiForbiddenResponse({
    description: 'Not your request, or request is not in pending status',
  })
  async removeAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveAttachmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.overtimeService.removeOvertimeAttachment(
      id,
      req.user.id,
      req.user.tenant_id,
      dto.url,
    );
  }
}
