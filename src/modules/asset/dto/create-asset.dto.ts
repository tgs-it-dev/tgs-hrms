import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({ example: 'MacBook Pro 16"' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Laptop' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'uuid-of-subcategory', required: false })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiProperty({ example: '2024-01-10', required: false })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;
}


