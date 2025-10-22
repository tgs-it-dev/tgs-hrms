import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAssetRequestDto {
  @ApiProperty({ example: 'Laptop' })
  @IsString()
  assetCategory: string;

  @ApiProperty({ example: 'uuid-of-subcategory', required: false })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiProperty({ example: 'Need for design work', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}


