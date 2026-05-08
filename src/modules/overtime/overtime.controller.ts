import {
  Controller,
  Get,
  Post,
  Patch,
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
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';

import { OvertimeService } from './overtime.service';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { OvertimeStatus } from '../../common/constants/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('Overtime')
@ApiBearerAuth()
@Controller('overtime')
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit an overtime request' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['start_date', 'end_date', 'hours', 'reason'],
      properties: {
        start_date: { type: 'string', format: 'date' },
        end_date: { type: 'string', format: 'date' },
        hours: { type: 'number' },
        reason: { type: 'string' },
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Optional supporting documents (max 5 MB each)',
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          return cb(
            new BadRequestException(
              `Invalid file type: ${file.mimetype ?? 'unknown'}. Only images are allowed.`,
            ),
            false,
          );
        }
        cb(null, true);
      },
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
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
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
  @UseGuards(RolesGuard)
  @Roles('admin', 'hr-admin', 'system-admin', 'network-admin', 'manager')
  @ApiOperation({
    summary: 'List all overtime requests across the tenant (admin/manager)',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', enum: OvertimeStatus, required: false })
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
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.overtimeService.getOvertimeById(id, req.user.tenant_id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending overtime request' })
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
}
