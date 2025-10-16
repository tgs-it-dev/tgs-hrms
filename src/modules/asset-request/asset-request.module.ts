import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetRequest } from '../../entities/asset-request.entity';
import { Asset } from '../../entities/asset.entity';
import { User } from '../../entities/user.entity';
import { AssetRequestService } from './asset-request.service';
import { AssetRequestController } from './asset-request.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([AssetRequest, Asset, User]), SharedJwtModule],
  controllers: [AssetRequestController],
  providers: [AssetRequestService],
})
export class AssetRequestModule {}


