import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CompleteSignupDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signupSessionId: string;
}

