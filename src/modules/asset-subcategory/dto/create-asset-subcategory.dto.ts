import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAssetSubcategoryDto {
  @ApiProperty({ example: 'Gaming Laptop' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Laptop' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'High-performance gaming laptops', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
