import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
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

import { WfhService } from './wfh.service';
import { CreateWfhDto } from './dto/create-wfh.dto';
import { UpdateWfhDto } from './dto/update-wfh.dto';
import { RemoveAttachmentDto } from '../../common/dto/remove-attachment.dto';
import { WfhStatus } from '../../common/constants/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedRequest } from 'src/common/types/request.types';
import { createImageFileFilter } from '../../common/utils/file-validation.util';

const WFH_EXAMPLE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  employee_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  tenant_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  start_date: '2026-05-12',
  end_date: '2026-05-14',
  reason: 'Working remotely during office renovation',
  status: 'pending',
  attachments: [],
  workflow_request_id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
  created_at: '2026-05-09T08:00:00.000Z',
  updated_at: '2026-05-09T08:00:00.000Z',
};

const PAGINATED_WFH_EXAMPLE = {
  items: [WFH_EXAMPLE],
  total: 1,
  page: 1,
  limit: 20,
};

@ApiTags('WFH')
@ApiBearerAuth()
@Controller('wfh')
export class WfhController {
  constructor(private readonly wfhService: WfhService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit a WFH request' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['start_date', 'end_date', 'reason'],
      properties: {
        start_date: {
          type: 'string',
          format: 'date',
          example: '2026-05-12',
          description: 'First day of WFH (ISO 8601)',
        },
        end_date: {
          type: 'string',
          format: 'date',
          example: '2026-05-14',
          description: 'Last day of WFH — must be >= start_date (ISO 8601)',
        },
        reason: {
          type: 'string',
          minLength: 5,
          maxLength: 500,
          example: 'Working remotely during office renovation',
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
    description: 'WFH request created and workflow initiated',
    schema: { example: WFH_EXAMPLE },
  })
  @ApiBadRequestResponse({
    description:
      'Validation error — e.g. end_date before start_date, workflow disabled',
  })
  @ApiForbiddenResponse({
    description:
      'An overlapping pending or approved WFH request already exists',
  })
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: createImageFileFilter(),
    }),
  )
  async create(
    @Body() dto: CreateWfhDto,
    @Request() req: AuthenticatedRequest,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.wfhService.createWfhRequest(
      req.user.id,
      req.user.tenant_id,
      dto,
      files,
    );
  }

  // must be before /:id so NestJS does not match 'me' as a UUID param
  @Get('me')
  @ApiOperation({ summary: 'List WFH requests submitted by the current user' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({
    description: 'Paginated list of WFH requests for the logged-in user',
    schema: { example: PAGINATED_WFH_EXAMPLE },
  })
  async getMyRequests(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wfhService.getMyWfhRequests(
      req.user.id,
      req.user.tenant_id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'hr-admin', 'system-admin', 'network-admin', 'manager')
  @ApiOperation({
    summary: 'List all WFH requests across the tenant (admin/manager)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', enum: WfhStatus, required: false })
  @ApiOkResponse({
    description: 'Paginated list of all WFH requests with employee info',
    schema: { example: PAGINATED_WFH_EXAMPLE },
  })
  async getAllRequests(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: WfhStatus,
  ) {
    return this.wfhService.getAllWfhRequests(
      req.user.tenant_id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single WFH request by ID' })
  @ApiParam({ name: 'id', description: 'WFH request UUID' })
  @ApiOkResponse({
    description: 'WFH request detail with workflow status and approver names',
    schema: {
      example: {
        ...WFH_EXAMPLE,
        workflow: {
          id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
          status: 'approved',
          request_type: 'wfh',
          current_step_order: 1,
          total_steps: 1,
          requestor: {
            id: WFH_EXAMPLE.employee_id,
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
  @ApiNotFoundResponse({ description: 'WFH request not found' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.wfhService.getWfhById(id, req.user.tenant_id);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Edit a pending WFH request' })
  @ApiParam({ name: 'id', description: 'WFH request UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', format: 'date', example: '2026-05-12' },
        end_date: { type: 'string', format: 'date', example: '2026-05-14' },
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
    description: 'Updated WFH request',
    schema: { example: WFH_EXAMPLE },
  })
  @ApiNotFoundResponse({ description: 'WFH request not found' })
  @ApiForbiddenResponse({
    description: 'Not your request, or request is not in pending status',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — e.g. end_date before start_date',
  })
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: createImageFileFilter(),
    }),
  )
  async edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWfhDto,
    @Request() req: AuthenticatedRequest,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.wfhService.editWfhRequest(
      id,
      req.user.id,
      req.user.tenant_id,
      dto,
      files,
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending WFH request' })
  @ApiParam({ name: 'id', description: 'WFH request UUID' })
  @ApiOkResponse({
    description: 'WFH request cancelled',
    schema: { example: { ...WFH_EXAMPLE, status: 'cancelled' } },
  })
  @ApiNotFoundResponse({ description: 'WFH request not found' })
  @ApiForbiddenResponse({
    description: 'Not your request, or request is not in pending status',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.wfhService.cancelWfhRequest(
      id,
      req.user.id,
      req.user.tenant_id,
    );
  }

  @Delete(':id/attachments')
  @ApiOperation({ summary: 'Remove an attachment from a pending WFH request' })
  @ApiParam({ name: 'id', description: 'WFH request UUID' })
  @ApiBody({ type: RemoveAttachmentDto })
  @ApiOkResponse({
    description: 'Updated WFH request with the attachment removed',
    schema: { example: WFH_EXAMPLE },
  })
  @ApiNotFoundResponse({ description: 'WFH request not found' })
  @ApiBadRequestResponse({ description: 'URL not found on this request' })
  @ApiForbiddenResponse({
    description: 'Not your request, or request is not in pending status',
  })
  async removeAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveAttachmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.wfhService.removeWfhAttachment(
      id,
      req.user.id,
      req.user.tenant_id,
      dto.url,
    );
  }
}
