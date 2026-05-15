import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from 'src/entities/base.entity';

export class IpWhitelistEntryDto extends BaseEntity {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  tenant_id!: string;

  @ApiProperty({ example: '192.168.1.100' })
  ip_address!: string;

  @ApiProperty({ example: 'Main office network', nullable: true })
  description!: string | null;
}

export class IpRestrictionToggleResponseDto {
  @ApiProperty({ example: 'IP restriction enabled' })
  message!: string;
}

export class RemoveIpResponseDto {
  @ApiProperty({ example: true })
  deleted!: true;

  @ApiProperty({ example: '192.168.1.100' })
  ip_address!: string;
}
