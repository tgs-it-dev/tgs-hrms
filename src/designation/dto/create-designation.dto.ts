import { IsNotEmpty, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Software Engineer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9 &'-]+$/, {
    message: 'Title can only contain letters, numbers, spaces, and -& characters.',
  })
  title: string;

  @ApiProperty({ example: 'Responsible for backend development', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'uuid-of-department' })
  @IsNotEmpty()
  @IsString()
  departmentId: string;
}