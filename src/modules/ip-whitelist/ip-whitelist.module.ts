import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantIpWhitelist } from '../../entities/tenant-ip-whitelist.entity';
import { IpWhitelistController } from './ip-whitelist.controller';
import { IpWhitelistService } from './ip-whitelist.service';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([TenantIpWhitelist]),
    TenantSettingsModule,
    SharedJwtModule,
  ],
  controllers: [IpWhitelistController],
  providers: [IpWhitelistService],
  exports: [IpWhitelistService],
})
export class IpWhitelistModule {}
