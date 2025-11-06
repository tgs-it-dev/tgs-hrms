import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateAssetSubcategoryDto {
  @ApiProperty({ example: 'Gaming Laptop' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'uuid-of-category' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ example: 'High-performance gaming laptops', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
