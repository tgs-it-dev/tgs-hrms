import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleMobileLoginDto {
  @ApiProperty({
    example: false,
    description: 'Set to false to block mobile login for this tenant',
  })
  @IsBoolean()
  enabled!: boolean;
}
