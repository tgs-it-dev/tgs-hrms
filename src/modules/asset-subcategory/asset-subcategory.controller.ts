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
import { AssetSubcategoryService } from './asset-subcategory.service';
import { CreateAssetSubcategoryDto } from './dto/create-asset-subcategory.dto';
import { UpdateAssetSubcategoryDto } from './dto/update-asset-subcategory.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Asset Subcategories')
@ApiBearerAuth()
@Controller('asset-subcategories')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AssetSubcategoryController {
  constructor(private readonly subcategoryService: AssetSubcategoryService) {}

  @Post()
  @Roles('system-admin', 'network-admin')
  @ApiOperation({ summary: 'Create a new asset subcategory' })
  @ApiResponse({ status: 201, description: 'Subcategory created' })
  create(@Body() dto: CreateAssetSubcategoryDto, @Request() req: any) {
    return this.subcategoryService.create(dto, req.user.tenant_id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subcategories (filter by category)' })
  findAll(
    @Request() req: any,
    @Query('category') category?: string,
  ) {
    return this.subcategoryService.findAll(req.user.tenant_id, category);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all available categories' })
  getCategories(@Request() req: any) {
    return this.subcategoryService.getCategories(req.user.tenant_id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subcategory details' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.subcategoryService.findOne(req.user.tenant_id, id);
  }

  @Put(':id')
  @Roles('system-admin', 'network-admin')
  @ApiOperation({ summary: 'Update subcategory info' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAssetSubcategoryDto) {
    return this.subcategoryService.update(req.user.tenant_id, id, dto);
  }

  @Delete(':id')
  @Roles('system-admin', 'network-admin')
  @ApiOperation({ summary: 'Delete subcategory' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.subcategoryService.remove(req.user.tenant_id, id);
  }
}
