import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '../../entities/asset.entity';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, User, Tenant]), SharedJwtModule],
  controllers: [AssetController],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule {}


