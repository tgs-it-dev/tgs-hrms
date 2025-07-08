import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DesignationService } from './designation.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { TenantGuard } from 'src/common/guards/company.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { TenantId } from 'src/common/decorators/company.deorator';

@ApiTags('Designations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('designations')
export class DesignationController {
  constructor(private readonly service: DesignationService) {}

  /* ────────── CREATE ────────── */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create designation under a department' })
  @ApiResponse({ status: 201, description: 'Designation created.' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid department.' })
  @ApiResponse({ status: 409, description: 'Duplicate designation title.' })
  async create(@TenantId() tenantId: string, @Body() dto: CreateDesignationDto) {
    return this.service.create(tenantId, dto);
  }

  /* ────────── LIST BY DEPARTMENT ────────── */
  @Get()
  @ApiOperation({ summary: 'List designations for a department' })
  @ApiResponse({ status: 200, description: 'Array of designations.' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('department_id') departmentId: string,
  ) {
    return this.service.findAll(tenantId, departmentId);
  }

  /* ────────── GET ONE ────────── */
  @Get(':id')
  @ApiOperation({ summary: 'Get designation by ID' })
  @ApiResponse({ status: 200, description: 'Designation found.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  /* ────────── UPDATE ────────── */
  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update designation title or department' })
  @ApiResponse({ status: 200, description: 'Designation updated.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  @ApiResponse({ status: 409, description: 'Duplicate designation title.' })
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  /* ────────── DELETE ────────── */
  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete designation' })
  @ApiResponse({ status: 200, description: 'Designation deleted.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }
}
