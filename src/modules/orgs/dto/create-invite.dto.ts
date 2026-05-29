import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrgMemberRole } from '../../../common/constants/enums';

export class CreateInviteDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: OrgMemberRole, example: OrgMemberRole.MEMBER })
  @IsEnum(OrgMemberRole)
  role: OrgMemberRole;
}
