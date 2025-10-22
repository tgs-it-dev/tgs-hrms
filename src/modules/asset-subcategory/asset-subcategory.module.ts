import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetSubcategory } from '../../entities/asset-subcategory.entity';
import { AssetSubcategoryService } from './asset-subcategory.service';
import { AssetSubcategoryController } from './asset-subcategory.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([AssetSubcategory]), SharedJwtModule],
  controllers: [AssetSubcategoryController],
  providers: [AssetSubcategoryService],
  exports: [AssetSubcategoryService],
})
export class AssetSubcategoryModule {}
