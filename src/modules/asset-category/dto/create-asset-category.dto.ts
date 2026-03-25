import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAssetCategoryDto {
  @ApiProperty({ example: 'IT Equipment' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'IT equipment and devices', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'laptop-icon.svg', required: false })
  @IsOptional()
  @IsString()
  icon?: string;
}

