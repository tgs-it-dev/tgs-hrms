import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TenantGuard } from 'src/common/guards/tenant.guard';
import { Roles } from 'src/common/guards/company.guard';
import { PolicyService } from './policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@ApiTags('Policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('policies')
export class PolicyController {
  constructor(private readonly service: PolicyService) {}

  @Post()
  @Roles('admin', 'system-admin', 'hr')
  @ApiOperation({ summary: 'Add a policy (e.g., attendance rules, leave policy)' })
  @ApiResponse({ status: 201, description: 'Policy created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 409, description: 'A similar policy already exists.' })
  async create(@Req() req, @Body() dto: CreatePolicyDto) {
    const tenant_id = req.user.tenant_id;
    const created = await this.service.create(tenant_id, dto);
    return { message: 'Policy created successfully', data: created };
  }

  @Get()
  @Roles('admin', 'system-admin', 'hr')
  @ApiOperation({ summary: 'List all policies (tenant-scoped)' })
  async findAll(@Req() req, @Query('page') page?: string, @Query('size') size?: string) {
    const tenant_id = req.user.tenant_id;
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(size || '25', 10) || 25));
    return this.service.findAll(tenant_id, pageNum, pageSize);
  }

  @Put(':id')
  @Roles('admin', 'system-admin', 'hr')
  @ApiOperation({ summary: 'Edit existing policy' })
  async update(@Req() req, @Param('id') id: string, @Body() dto: UpdatePolicyDto) {
    const tenant_id = req.user.tenant_id;
    const updated = await this.service.update(tenant_id, id, dto);
    return { message: 'Policy updated successfully', data: updated };
  }

  @Delete(':id')
  @Roles('admin', 'system-admin', 'hr')
  @ApiOperation({ summary: 'Soft delete a policy' })
  async remove(@Req() req, @Param('id') id: string) {
    const tenant_id = req.user.tenant_id;
    return this.service.softDelete(tenant_id, id);
  }
}


