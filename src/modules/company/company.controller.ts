import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@ApiTags('Company')
@ApiBearerAuth()
@Controller('company')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new company (Admin only)' })
  @ApiResponse({ status: 201, description: 'Company created successfully', type: Object })
  @ApiResponse({ status: 403, description: 'Forbidden - Only administrators can create companies', type: Object })
  create(@Body() dto: CreateCompanyDto, @Request() req) {
    return this.companyService.create(dto, req.user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get all companies (Admin/Staff only)' })
  @ApiResponse({ status: 200, description: 'List of companies retrieved successfully', type: Object })
  findAll() {
    return this.companyService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get a specific company by ID (Admin/Staff only)' })
  @ApiResponse({ status: 200, description: 'Company retrieved successfully', type: Object })
  @ApiResponse({ status: 404, description: 'Company not found', type: Object })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.companyService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a company (Admin only)' })
  @ApiResponse({ status: 200, description: 'Company updated successfully', type: Object })
  @ApiResponse({ status: 403, description: 'Forbidden - Only administrators can update companies', type: Object })
  @ApiResponse({ status: 404, description: 'Company not found', type: Object })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCompanyDto,
    @Request() req,
  ) {
    return this.companyService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a company (Admin only)' })
  @ApiResponse({ status: 200, description: 'Company deleted successfully', type: Object })
  @ApiResponse({ status: 403, description: 'Forbidden - Only administrators can delete companies', type: Object })
  @ApiResponse({ status: 404, description: 'Company not found', type: Object })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.companyService.remove(id, req.user);
  }
}
