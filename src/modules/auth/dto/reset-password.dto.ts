import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsEmail, IsNotEmpty } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
