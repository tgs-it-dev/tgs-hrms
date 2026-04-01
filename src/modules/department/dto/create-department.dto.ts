import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

function trimOptionalDescription(value: unknown): string | null | undefined {
  if (value === '' || value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return undefined;
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9 &'-]+$/, {
    message: 'Name can only contain letters, numbers, spaces, and -& characters.',
  })
  name: string;

  @ApiProperty({ example: 'Software & QA', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalDescription(value))
  description?: string | null;
}
