import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../../common/types/request.types';
import { GeofenceService } from './geofence.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { UpdateGeofenceDto } from './dto/update-geofence.dto';

@ApiTags('Geofences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
@Controller('geofences')
export class GeofenceController {
  constructor(private readonly service: GeofenceService) {}

  @Post()
  @Roles('admin', 'system-admin', 'hr-admin', 'manager')
  @Permissions('manage_geofences')
  @ApiOperation({ summary: 'Create geofence for a team' })
  @ApiResponse({ status: 201, description: 'Geofence created.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Managers can only create geofences for teams they manage.' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateGeofenceDto) {
    return await this.service.create(
      req.user.tenant_id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Get()
  @Roles('admin', 'system-admin', 'hr-admin', 'manager')
  @Permissions('manage_geofences')
  @ApiOperation({ summary: 'List geofences (optionally filtered by team)' })
  @ApiQuery({ name: 'team_id', required: false, description: 'Filter by team ID' })
  @ApiResponse({ status: 200, description: 'List of geofences returned.' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('team_id') team_id?: string,
  ) {
    return await this.service.findAll(
      req.user.tenant_id,
      team_id,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':id')
  @Roles('admin', 'system-admin', 'hr-admin', 'manager')
  @Permissions('manage_geofences')
  @ApiOperation({ summary: 'Get geofence by ID' })
  @ApiResponse({ status: 200, description: 'Geofence found.' })
  @ApiResponse({ status: 404, description: 'Geofence not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Managers can only view geofences for teams they manage.' })
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return await this.service.findOne(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Patch(':id')
  @Roles('admin', 'system-admin', 'hr-admin', 'manager')
  @Permissions('manage_geofences')
  @ApiOperation({ summary: 'Update geofence' })
  @ApiResponse({ status: 200, description: 'Geofence updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Managers can only update geofences for teams they manage.' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateGeofenceDto,
  ) {
    return await this.service.update(
      req.user.tenant_id,
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':id')
  @Roles('admin', 'system-admin', 'hr-admin', 'manager')
  @Permissions('manage_geofences')
  @ApiOperation({ summary: 'Delete geofence' })
  @ApiResponse({ status: 200, description: 'Geofence deleted.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Managers can only delete geofences for teams they manage.' })
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return await this.service.remove(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.role,
    );
  }
}

