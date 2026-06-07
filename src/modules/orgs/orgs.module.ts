import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMember } from '../../entities/org-member.entity';
import { OrgInvite } from '../../entities/org-invite.entity';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { OrgsService } from './orgs.service';
import { OrgsController } from './orgs.controller';
import { EmailModule } from '../../common/utils/email/email.module';
import { SysDbModule } from '../../common/modules/sys-db.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrgMember, OrgInvite, Tenant, User]),
    EmailModule,
    SysDbModule,
  ],
  controllers: [OrgsController],
  providers: [OrgsService],
  exports: [OrgsService],
})
export class OrgsModule {}
