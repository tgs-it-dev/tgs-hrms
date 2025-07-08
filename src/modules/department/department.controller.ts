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
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantGuard } from '../../common/guards/company.guard';
import { TenantId } from '../../common/decorators/company.deorator';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private service: DepartmentService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create department' })
  @ApiResponse({ status: 201, description: 'Department created.' })
  @ApiResponse({ status: 409, description: 'Department name must be unique within tenant.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  async create(@TenantId() tenantId: number, @Body() dto: CreateDepartmentDto) {
    return await this.service.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List departments' })
  @ApiResponse({ status: 200, description: 'List of departments.' })
  async findAll(@TenantId() tenantId: number) {
    return await this.service.findAll(tenantId);
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get department' })
  @ApiResponse({ status: 200, description: 'Department found.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async findOne(@TenantId() tenantId: number, @Param('id') id: string) {
    return await this.service.findOne(tenantId, id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update department' })
  @ApiResponse({ status: 200, description: 'Department updated.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  @ApiResponse({ status: 409, description: 'Department name must be unique within tenant.' })
  async update(
    @TenantId() tenantId: number,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return await this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete department' })
  @ApiResponse({ status: 200, description: 'Department deleted.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async remove(@TenantId() tenantId: number, @Param('id') id: string) {
    return await this.service.remove(tenantId, id);
  }
}
