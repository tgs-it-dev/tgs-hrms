import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AddAssetCommentDto {
  @ApiProperty({ description: 'Comment text', example: 'Asset is in good condition and ready for use' })
  @IsString()
  @IsNotEmpty()
  comment: string;
}

