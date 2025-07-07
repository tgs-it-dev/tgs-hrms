import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Senior QA Engineer' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9 .,'\-&]+$/, {
    message: 'Title may contain letters, numbers, spaces and . , \' - & characters.',
  })
  title: string;

  @ApiProperty({ example: 'uuid-of-department' })
  @IsUUID()
  departmentId: string;
}
