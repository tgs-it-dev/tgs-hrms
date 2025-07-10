import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
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
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@ApiTags('Designations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('designations')
export class DesignationController {
  constructor(private readonly service: DesignationService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create designation' })
  @ApiResponse({ status: 201, description: 'Designation created.' })
  @ApiResponse({ status: 409, description: 'Duplicate designation title in department.' })
  async create(@Body() dto: CreateDesignationDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List designations' })
  @ApiResponse({ status: 200, description: 'List of designations.' })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get designation by ID' })
  @ApiResponse({ status: 200, description: 'Designation found.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update designation' })
  @ApiResponse({ status: 200, description: 'Designation updated.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  @ApiResponse({ status: 409, description: 'Duplicate designation title in department.' })
  async update(@Param('id') id: string, @Body() dto: UpdateDesignationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete designation' })
  @ApiResponse({ status: 200, description: 'Designation deleted.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
