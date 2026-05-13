import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/company.deorator';
import { ShiftService } from './shift.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { Repository } from 'typeorm';

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftController {
  constructor(
    private readonly shiftService: ShiftService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  private async isProvisioned(tenantId: string): Promise<boolean> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      select: ['id', 'schema_provisioned'],
    });
    return tenant?.schema_provisioned ?? false;
  }

  @Get()
  @Roles('admin', 'hr-admin', 'manager', 'system-admin')
  @ApiOperation({ summary: 'List all shifts for the tenant' })
  findAll(@TenantId() tenantId: string) {
    return this.shiftService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('admin', 'hr-admin', 'manager', 'system-admin')
  @ApiOperation({ summary: 'Get a single shift' })
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.shiftService.findOne(id, tenantId);
  }

  @Post()
  @Roles('admin', 'hr-admin', 'system-admin')
  @ApiOperation({ summary: 'Create a new shift' })
  create(@TenantId() tenantId: string, @Body() dto: CreateShiftDto) {
    return this.shiftService.create(tenantId, dto);
  }

  @Put(':id')
  @Roles('admin', 'hr-admin', 'system-admin')
  @ApiOperation({ summary: 'Update a shift' })
  update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shiftService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles('admin', 'hr-admin', 'system-admin')
  @ApiOperation({ summary: 'Delete a shift (unassigns all employees first)' })
  async remove(@Param('id') id: string, @TenantId() tenantId: string) {
    await this.shiftService.remove(id, tenantId);
    return { deleted: true, id };
  }

  @Patch('employees/:employeeId/assign')
  @Roles('admin', 'hr-admin', 'system-admin')
  @ApiOperation({ summary: 'Assign or unassign a shift for an employee' })
  async assignToEmployee(
    @Param('employeeId') employeeId: string,
    @TenantId() tenantId: string,
    @Body() dto: AssignShiftDto,
  ) {
    const provisioned = await this.isProvisioned(tenantId);
    await this.shiftService.assignToEmployee(
      employeeId,
      tenantId,
      dto.shift_id ?? null,
      provisioned,
    );
    return { success: true };
  }
}
