import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetRequest } from '../../entities/asset-request.entity';
import { Asset } from '../../entities/asset.entity';
import { AssetComment } from '../../entities/asset-comment.entity';
import { AssetCategory } from '../../entities/asset-category.entity';
import { AssetSubcategory } from '../../entities/asset-subcategory.entity';
import { User } from '../../entities/user.entity';
import { Employee } from '../../entities/employee.entity';
import { Team } from '../../entities/team.entity';
import { AssetRequestService } from './asset-request.service';
import { AssetRequestController } from './asset-request.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([AssetRequest, Asset, AssetComment, AssetCategory, AssetSubcategory, User, Employee, Team]), SharedJwtModule],
  controllers: [AssetRequestController],
  providers: [AssetRequestService],
})
export class AssetRequestModule {}


