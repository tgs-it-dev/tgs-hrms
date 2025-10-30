import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PayrollConfigService } from '../services/payroll-config.service';
import { CreatePayrollConfigDto, UpdatePayrollConfigDto } from '../dto/payroll-config.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Payroll Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('payroll/config')
export class PayrollConfigController {
  constructor(private readonly payrollConfigService: PayrollConfigService) {}

  @Post()
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Create payroll configuration for tenant' })
  @ApiResponse({ status: 201, description: 'Payroll configuration created successfully.' })
  @ApiResponse({ status: 400, description: 'Payroll configuration already exists.' })
  async create(@Req() req: any, @Body() dto: CreatePayrollConfigDto) {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    return await this.payrollConfigService.create(tenantId, userId, dto);
  }

  @Get()
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Get payroll configuration for tenant' })
  @ApiResponse({ status: 200, description: 'Payroll configuration retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Payroll configuration not found.' })
  async getByTenantId(@Req() req: any) {
    const tenantId = req.user.tenant_id;
    return await this.payrollConfigService.getByTenantId(tenantId);
  }

  @Put()
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Update payroll configuration for tenant' })
  @ApiResponse({ status: 200, description: 'Payroll configuration updated successfully.' })
  @ApiResponse({ status: 404, description: 'Payroll configuration not found.' })
  async update(@Req() req: any, @Body() dto: UpdatePayrollConfigDto) {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    return await this.payrollConfigService.update(tenantId, userId, dto);
  }
}

