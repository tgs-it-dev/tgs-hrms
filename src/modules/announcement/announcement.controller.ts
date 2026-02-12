import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedRequest } from 'src/modules/auth/interfaces';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto';

@ApiTags('Announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly service: AnnouncementService) {}

  @Post()
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('announcement.create')
  @ApiOperation({
    summary: 'Create a new announcement',
    description:
      'Create an announcement. Set send_now=true to send immediately, or set scheduled_at for scheduled delivery.',
  })
  @ApiResponse({ status: 201, description: 'Announcement created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions.' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAnnouncementDto,
  ) {
    const tenant_id = req.user.tenant_id;
    const created_by = req.user.id;
    const announcement = await this.service.create(tenant_id, created_by, dto);
    return {
      message: dto.send_now
        ? 'Announcement created and sent successfully.'
        : 'Announcement created successfully.',
      data: announcement,
    };
  }

  @Get()
  @Roles('admin', 'system-admin', 'hr-admin', 'manager', 'employee')
  @Permissions('announcement.read')
  @ApiOperation({
    summary: 'Get all announcements',
    description: 'Retrieve paginated list of all announcements for the tenant.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiResponse({ status: 200, description: 'List of announcements.' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
  ) {
    const tenant_id = req.user.tenant_id;
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.service.findAll(tenant_id, pageNum);
  }

  @Get('stats')
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('announcement.read')
  @ApiOperation({
    summary: 'Get announcement statistics',
    description: 'Get counts of drafts, scheduled, and sent announcements.',
  })
  @ApiResponse({ status: 200, description: 'Announcement statistics.' })
  async getStats(@Req() req: AuthenticatedRequest) {
    const tenant_id = req.user.tenant_id;
    return this.service.getStats(tenant_id);
  }

  @Get(':id')
  @Roles('admin', 'system-admin', 'hr-admin', 'manager', 'employee')
  @Permissions('announcement.read')
  @ApiOperation({
    summary: 'Get announcement by ID',
    description: 'Retrieve a specific announcement by its ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement details.' })
  @ApiResponse({ status: 404, description: 'Announcement not found.' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenant_id = req.user.tenant_id;
    return this.service.findOne(tenant_id, id);
  }

  @Put(':id')
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('announcement.update')
  @ApiOperation({
    summary: 'Update an announcement',
    description: 'Update an existing announcement. Cannot update if already sent.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement updated successfully.' })
  @ApiResponse({ status: 400, description: 'Cannot update sent announcement.' })
  @ApiResponse({ status: 404, description: 'Announcement not found.' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    const tenant_id = req.user.tenant_id;
    const updated = await this.service.update(tenant_id, id, dto);
    return {
      message: 'Announcement updated successfully.',
      data: updated,
    };
  }

  @Post(':id/send')
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('announcement.send')
  @ApiOperation({
    summary: 'Send an announcement',
    description: 'Send a draft or scheduled announcement immediately to all tenant users.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement sent successfully.' })
  @ApiResponse({ status: 400, description: 'Announcement already sent or cancelled.' })
  @ApiResponse({ status: 404, description: 'Announcement not found.' })
  async send(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenant_id = req.user.tenant_id;
    const announcement = await this.service.send(tenant_id, id);
    return {
      message: `Announcement sent to ${announcement.recipient_count} recipient(s).`,
      data: announcement,
    };
  }

  @Patch(':id/cancel')
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('announcement.update')
  @ApiOperation({
    summary: 'Cancel a scheduled announcement',
    description: 'Cancel a scheduled announcement. Cannot cancel if already sent.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement cancelled successfully.' })
  @ApiResponse({ status: 400, description: 'Cannot cancel sent announcement.' })
  @ApiResponse({ status: 404, description: 'Announcement not found.' })
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenant_id = req.user.tenant_id;
    const announcement = await this.service.cancel(tenant_id, id);
    return {
      message: 'Announcement cancelled successfully.',
      data: announcement,
    };
  }

  @Delete(':id')
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('announcement.delete')
  @ApiOperation({
    summary: 'Delete an announcement',
    description: 'Soft delete an announcement.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Announcement not found.' })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenant_id = req.user.tenant_id;
    return this.service.softDelete(tenant_id, id);
  }
}
