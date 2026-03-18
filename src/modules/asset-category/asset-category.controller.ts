import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssetCategoryService } from './asset-category.service';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Asset Categories')
@ApiBearerAuth()
@Controller('asset-categories')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AssetCategoryController {
  constructor(private readonly categoryService: AssetCategoryService) {}

  @Post()
  @Roles('system-admin', 'network-admin')
  @ApiOperation({ summary: 'Create a new asset category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  create(@Body() dto: CreateAssetCategoryDto, @Request() req: any) {
    return this.categoryService.create(dto, req.user.tenant_id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  findAll(@Request() req: any) {
    return this.categoryService.findAll(req.user.tenant_id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category details' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.categoryService.findOne(req.user.tenant_id, id);
  }

  @Put(':id')
  @Roles('system-admin', 'network-admin')
  @ApiOperation({ summary: 'Update category info' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAssetCategoryDto) {
    return this.categoryService.update(req.user.tenant_id, id, dto);
  }

  @Delete(':id')
  @Roles('system-admin', 'network-admin')
  @ApiOperation({ summary: 'Delete category' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.categoryService.remove(req.user.tenant_id, id);
  }
}

