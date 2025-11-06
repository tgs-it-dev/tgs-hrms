import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetRequest } from '../../entities/asset-request.entity';
import { Asset } from '../../entities/asset.entity';
import { AssetCategory } from '../../entities/asset-category.entity';
import { AssetSubcategory } from '../../entities/asset-subcategory.entity';
import { User } from '../../entities/user.entity';
import { AssetRequestService } from './asset-request.service';
import { AssetRequestController } from './asset-request.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([AssetRequest, Asset, AssetCategory, AssetSubcategory, User]), SharedJwtModule],
  controllers: [AssetRequestController],
  providers: [AssetRequestService],
})
export class AssetRequestModule {}


