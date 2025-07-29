import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { DesignationService } from './designation.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/company.guard';
import { TenantId } from '../../common/decorators/company.deorator';

@ApiTags('Designations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('designations')
export class DesignationController {
  constructor(private service: DesignationService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create designation' })
  @ApiResponse({ status: 201, description: 'Designation created.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: Title already exists in this department.',
    schema: {
      example: {
        statusCode: 409,
        message: 'Designation with this title already exists in this department',
        error: 'Conflict',
      },
    },
  })
  async create(@TenantId() tenantId: string, @Body() dto: CreateDesignationDto) {
    return this.service.create(tenantId, dto);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update designation' })
  @ApiResponse({ status: 200, description: 'Designation updated.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: Title already exists in this department.',
    schema: {
      example: {
        statusCode: 409,
        message: "Title 'Manager' already exists in this department.",
        error: 'Conflict',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    return this.service.update(id, dto);
  }

  @Get('department/:departmentId')
  @ApiOperation({ summary: 'List designations under a department' })
  @ApiResponse({ status: 200, description: 'List of designations.' })
  async findAll(@Param('departmentId') departmentId: string) {
    return this.service.findAllByDepartment(departmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single designation' })
  @ApiResponse({ status: 200, description: 'Designation found.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a designation' })
  @ApiResponse({ status: 200, description: 'Designation deleted.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
