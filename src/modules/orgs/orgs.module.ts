import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMember } from '../../entities/org-member.entity';
import { User } from '../../entities/user.entity';
import { OrgsService } from './orgs.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrgMember, User])],
  providers: [OrgsService],
  exports: [OrgsService],
})
export class OrgsModule {}
