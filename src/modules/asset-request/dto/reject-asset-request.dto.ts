import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class RejectAssetRequestDto {
  @ApiProperty({ 
    example: 'Budget constraints - asset not available in current quarter', 
    description: 'Reason for rejecting the asset request',
    required: false
  })
  @IsString()
  @IsOptional()
  rejection_reason?: string;
}
