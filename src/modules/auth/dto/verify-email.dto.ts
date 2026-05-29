import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token sent to the user' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
