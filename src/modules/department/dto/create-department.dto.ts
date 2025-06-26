// modules/department/dto/create-department.dto.ts
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Software & QA', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
