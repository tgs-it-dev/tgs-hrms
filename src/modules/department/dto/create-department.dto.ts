// modules/department/dto/create-department.dto.ts
// import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9 &'-]+$/, { message: 'Name can only contain letters, numbers, spaces, and -& characters.' })
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'Software & QA', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
