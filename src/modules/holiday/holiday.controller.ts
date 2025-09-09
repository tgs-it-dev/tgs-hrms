import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { HolidayService } from './holiday.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Holiday } from '../../entities/holiday.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Holidays')
@Controller('holidays')
@UseGuards(JwtAuthGuard)
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Post()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('manage_holidays')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new holiday for the tenant' })
  @ApiResponse({
    status: 201,
    description: 'Holiday created successfully',
    schema: {
      example: {
        id: 'holiday-uuid',
        name: 'New Year Day',
        date: '2025-01-01',
        description: 'Public holiday celebrating the new year',
        is_active: true,
        tenant_id: 'tenant-uuid',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Holiday already exists for this date',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or System-Admin role required',
  })
  async createHoliday(@Body() dto: CreateHolidayDto, @Request() req: any) {
    return this.holidayService.createHoliday(req.user.tenant_id, dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch holidays - tenant-specific for regular users, all holidays for system-admin' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
    example: 10,
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Filter holidays by year',
    example: 2025,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of holidays',
    schema: {
      example: {
        items: [
          {
            id: 'holiday-uuid-1',
            name: 'New Year Day',
            date: '2025-01-01',
            description: 'Public holiday celebrating the new year',
            is_active: true,
            tenant_id: 'tenant-uuid',
            created_at: '2024-01-15T10:30:00Z',
            updated_at: '2024-01-15T10:30:00Z',
          },
          {
            id: 'holiday-uuid-2',
            name: 'Independence Day',
            date: '2025-08-15',
            description: 'National Independence Day',
            is_active: true,
            tenant_id: 'tenant-uuid',
            created_at: '2024-01-15T10:30:00Z',
            updated_at: '2024-01-15T10:30:00Z',
          },
        ],
        total: 12,
        page: 1,
        limit: 10,
        totalPages: 2,
      },
    },
  })
  async getHolidays(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('year') year?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit || '10', 10) || 10));
    const yearNumber = year ? parseInt(year, 10) : undefined;

    // System-admin can access all holidays, regular users only their tenant's holidays
    const tenantId = req.user.role === 'system-admin' ? null : req.user.tenant_id;

    return this.holidayService.getHolidays(
      tenantId,
      pageNumber,
      limitNumber,
      yearNumber,
    );
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific holiday by ID - tenant-specific for regular users, any holiday for system-admin' })
  @ApiResponse({
    status: 200,
    description: 'Returns holiday details',
    schema: {
      example: {
        id: 'holiday-uuid',
        name: 'New Year Day',
        date: '2025-01-01',
        description: 'Public holiday celebrating the new year',
        is_active: true,
        tenant_id: 'tenant-uuid',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Holiday not found',
  })
  async getHolidayById(@Param('id') id: string, @Request() req: any) {
    // System-admin can access any holiday, regular users only their tenant's holidays
    const tenantId = req.user.role === 'system-admin' ? null : req.user.tenant_id;
    return this.holidayService.getHolidayById(id, tenantId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('manage_holidays')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a holiday - tenant-specific for admin, any holiday for system-admin' })
  @ApiResponse({
    status: 200,
    description: 'Holiday updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Holiday already exists for this date',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or System-Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Holiday not found',
  })
  async updateHoliday(
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
    @Request() req: any,
  ) {
    // System-admin can update any holiday, admin can only update their tenant's holidays
    const tenantId = req.user.role === 'system-admin' ? null : req.user.tenant_id;
    return this.holidayService.updateHoliday(id, tenantId, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('manage_holidays')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a holiday - tenant-specific for admin, any holiday for system-admin' })
  @ApiResponse({
    status: 200,
    description: 'Holiday deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or System-Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Holiday not found',
  })
  async deleteHoliday(@Param('id') id: string, @Request() req: any) {
    // System-admin can delete any holiday, admin can only delete their tenant's holidays
    const tenantId = req.user.role === 'system-admin' ? null : req.user.tenant_id;
    await this.holidayService.deleteHoliday(id, tenantId);
    return { message: 'Holiday deleted successfully' };
  }

  @Get('check/:date')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if a specific date is a holiday - tenant-specific for regular users, any tenant for system-admin' })
  @ApiResponse({
    status: 200,
    description: 'Returns whether the date is a holiday',
    schema: {
      example: {
        isHoliday: true,
        holiday: {
          id: 'holiday-uuid',
          name: 'New Year Day',
          date: '2025-01-01',
          description: 'Public holiday celebrating the new year',
          is_active: true,
        },
      },
    },
  })
  async checkHoliday(@Param('date') date: string, @Request() req: any) {
    const holidayDate = new Date(date);
    
    // System-admin can check holidays across all tenants, regular users only their tenant
    const tenantId = req.user.role === 'system-admin' ? null : req.user.tenant_id;
    
    const isHoliday = await this.holidayService.isHoliday(tenantId, holidayDate);
    
    let holiday: Holiday | null = null;
    if (isHoliday) {
      // Get the holiday for the specific date
      const holidays = await this.holidayService.getHolidaysByDateRange(
        tenantId,
        holidayDate,
        holidayDate,
      );
      holiday = holidays.length > 0 ? holidays[0] : null;
    }

    return {
      isHoliday,
      holiday: isHoliday ? holiday : null,
    };
  }
}
