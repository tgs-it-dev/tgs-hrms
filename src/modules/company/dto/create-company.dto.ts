import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Telenor Pakistan' })
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
