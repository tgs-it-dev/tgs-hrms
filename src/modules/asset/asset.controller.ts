import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Post()
  @Roles('system-admin', 'network-admin')
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiResponse({ status: 201, description: 'Asset created' })
  create(@Body() dto: CreateAssetDto, @Request() req: any) {
    return this.assetService.create(dto, req.user.tenant_id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all assets (filter by status, categoryId, paginated)' })
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
  ) {
    // Always 25 records per page
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.assetService.findAll(req.user.tenant_id, {
      status,
      categoryId,
      page: parsedPage
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset details' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.assetService.findOne(req.user.tenant_id, id);
  }

  @Put(':id')
  @Roles('system-admin', 'network-admin')
  @ApiOperation({ summary: 'Update asset info' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetService.update(req.user.tenant_id, id, dto);
  }

  @Delete(':id')
  @Roles('system-admin', 'network-admin')
  @ApiOperation({ summary: 'Soft delete asset' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.assetService.softDelete(req.user.tenant_id, id);
  }
}


