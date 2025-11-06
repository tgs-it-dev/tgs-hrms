import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetCategory } from '../../entities/asset-category.entity';
import { AssetCategoryService } from './asset-category.service';
import { AssetCategoryController } from './asset-category.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([AssetCategory]), SharedJwtModule],
  controllers: [AssetCategoryController],
  providers: [AssetCategoryService],
  exports: [AssetCategoryService],
})
export class AssetCategoryModule {}

