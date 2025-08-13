import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateLeaveDto {
  @ApiProperty({ example: '2025-08-10' })
  @IsDateString()
  from_date: string;

  @ApiProperty({ example: '2025-08-15' })
  @IsDateString()
  to_date: string;

  @ApiProperty({ example: 'Family function' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ example: 'casual' })
  @IsString()
  @IsNotEmpty()
  type: string;
}
