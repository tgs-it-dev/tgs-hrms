import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '../../entities/asset.entity';
import { AssetRequest } from '../../entities/asset-request.entity';
import { AssetCategory } from '../../entities/asset-category.entity';
import { AssetSubcategory } from '../../entities/asset-subcategory.entity';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { Employee } from '../../entities/employee.entity';
import { Team } from '../../entities/team.entity';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, AssetRequest, AssetCategory, AssetSubcategory, User, Tenant, Employee, Team]), 
    SharedJwtModule
  ],
  controllers: [AssetController],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule {}


