import {
  Controller,
  Get,
  Post,
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
  ApiQuery,
} from '@nestjs/swagger';
import { HolidayService } from './holiday.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Holidays')
@Controller('holidays')
@UseGuards(JwtAuthGuard)
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add a new holiday for a tenant',
    description: "Creates a new holiday entry for the authenticated user's tenant. Only admins can create holidays.",
  })
  @ApiResponse({
    status: 201,
    description: 'Holiday created successfully',
    schema: {
      example: {
        success: true,
        message: 'Holiday created successfully',
        data: {
          id: 'uuid-string',
          tenant_id: 'tenant-uuid',
          name: 'New Year Day',
          date: '2025-01-01',
          description: 'Public holiday celebrating the new year',
          is_active: true,
        },
      },
    },
  })
  async createHoliday(@Request() req: any, @Body() dto: CreateHolidayDto) {
    const holiday = await this.holidayService.createHoliday(
      req.user.tenant_id,
      dto,
    );

    return {
      success: true,
      message: 'Holiday created successfully',
      data: holiday,
    };
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch tenant-specific holidays',
    description: "Retrieves holidays for the authenticated user's tenant with optional filtering by year and month.",
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Filter holidays by year (e.g., 2025)',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    type: Number,
    description: 'Filter holidays by month (1-12)',
  })
  @ApiResponse({
    status: 200,
    description: 'Holidays retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Holidays retrieved successfully',
        data: [
          {
            id: 'uuid-string',
            tenant_id: 'tenant-uuid',
            name: 'New Year Day',
            date: '2025-01-01',
            description: 'Public holiday celebrating the new year',
            is_active: true,
          },
        ],
        total: 1,
      },
    },
  })
  async getHolidays(
    @Request() req: any,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const yearNumber = year ? parseInt(year, 10) : undefined;
    const monthNumber = month ? parseInt(month, 10) : undefined;

    const holidays = await this.holidayService.getHolidays(
      req.user.tenant_id,
      yearNumber,
      monthNumber,
    );

    return {
      success: true,
      message: 'Holidays retrieved successfully',
      data: holidays,
      total: holidays.length,
    };
  }
}
