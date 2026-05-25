import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SystemSettingsService } from './system-settings.service';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

class UpdateSettingDto {
  @IsString({ message: 'Value must be a string' })
  @IsNotEmpty({ message: 'Value is required' })
  value!: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;
}

@ApiTags('System')
@Controller('system/settings')
@Roles('system-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemSettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all system settings' })
  getAll() {
    return this.settingsService.getAll();
  }

  @Put(':key')
  @ApiOperation({ summary: 'Update a system setting by key' })
  async update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    await this.settingsService.set(key, dto.value, dto.description);
    return { key, value: dto.value };
  }

  @Post('reload')
  @ApiOperation({ summary: 'Reload settings cache from the database' })
  async reload() {
    await this.settingsService.reloadCache();
    return { message: 'Settings cache reloaded.' };
  }
}
