import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateAssetRequestDto {
  @ApiProperty({ example: 'Laptop' })
  @IsString()
  assetCategory: string;

  @ApiProperty({ example: 'Need for design work', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}


