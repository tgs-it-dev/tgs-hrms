
import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CreateDepartmentDto } from './create-department.dto';

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
  @ApiProperty({ example: 'Engineering', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9 &'-]+$/, {
    message: 'Name can only contain letters, numbers, spaces, and -& characters.',
  })
  name?: string;

  @ApiProperty({ example: 'Software & QA', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;
}
